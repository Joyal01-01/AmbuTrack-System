import express from "express";
import db from "../config/db.js";
import bcrypt from "bcryptjs";
import { createWorker } from "tesseract.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Middleware: Authenticate Admin
function authAdmin(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
  
  db.query('SELECT * FROM users WHERE token=?', [token], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error', details: err });
    if (!rows.length) return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    
    const user = rows[0];
    if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
    
    req.admin = user;
    next();
  });
}

// Apply admin authentication to all routes in this file
router.use(authAdmin);

// GET /api/admin/stats
router.get("/stats", (req, res) => {
  const stats = {};
  db.query("SELECT COUNT(*) AS total FROM users WHERE role='driver'", (err, result) => {
    if (err) return res.status(500).json(err);
    stats.totalAmbulances = result[0].total;
    
    db.query("SELECT COUNT(*) AS online FROM drivers WHERE status='online'", (err, result) => {
      if (err) return res.status(500).json(err);
      stats.onlineAmbulances = result[0].online;
      
      db.query("SELECT COUNT(*) AS active FROM trips WHERE status!='completed'", (err, result) => {
        if (err) return res.status(500).json(err);
        stats.activeTrips = result[0].active;
        
        db.query("SELECT COUNT(*) AS completed FROM trips WHERE status='completed'", (err, result) => {
          if (err) return res.status(500).json(err);
          stats.completedTrips = result[0].completed;
          res.json(stats);
        });
      });
    });
  });
});

// GET /api/admin/drivers/pending
router.get("/drivers/pending", (req, res) => {
  db.query(
    "SELECT id, name, email, phone, role, approval_status, vehicle_name, vehicle_type, license_photo, nid_photo, ocr_result, ocr_flags, createdAt FROM users WHERE role='driver' AND approval_status='pending' ORDER BY createdAt DESC",
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows || []);
    }
  );
});

// POST /api/admin/drivers/:id/run-ocr  — AI Document Verification
router.post("/drivers/:id/run-ocr", async (req, res) => {
  const driverUserId = req.params.id;

  try {
    // Fetch driver's uploaded document paths
    const rows = await new Promise((resolve, reject) =>
      db.query(
        "SELECT license_photo, nid_photo, license_expiry FROM users WHERE id=? AND role='driver'",
        [driverUserId],
        (err, r) => (err ? reject(err) : resolve(r))
      )
    );

    if (!rows || rows.length === 0)
      return res.status(404).json({ error: "Driver not found" });

    const driver = rows[0];
    const photoPaths = [
      { label: "License", urlPath: driver.license_photo },
      { label: "NID", urlPath: driver.nid_photo },
    ].filter((p) => p.urlPath);

    if (photoPaths.length === 0)
      return res.status(400).json({ error: "No documents uploaded by driver" });

    // Resolve filesystem paths from URL paths like /uploads/filename.jpg
    const uploadsDir = path.join(__dirname, "..", "uploads");
    const results = [];
    const flags = [];

    const worker = await createWorker("eng");

    for (const photo of photoPaths) {
      const filename = path.basename(photo.urlPath);
      const filePath = path.join(uploadsDir, filename);

      if (!fs.existsSync(filePath)) {
        results.push(`${photo.label}: file not found on server`);
        flags.push(`${photo.label} file missing`);
        continue;
      }

      const { data } = await worker.recognize(filePath);
      const text = data.text || "";
      results.push(`${photo.label}:\n${text.trim()}`);

      // --- Heuristic checks ---
      // 1. Look for expiry date patterns: EXP, EXPIRY, EXPIRES, VALID UNTIL, etc.
      const expiryMatch = text.match(
        /(?:exp(?:iry|ires|\.|iration)?|valid\s+(?:until|thru)|renewal)\D{0,15}(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i
      );
      if (expiryMatch) {
        const extractedDateStr = expiryMatch[1];
        const parts = extractedDateStr.split(/[\/\-]/).map(Number);
        let expiryDate = null;
        // Handle YYYY-MM-DD or DD/MM/YYYY heuristics
        if (parts[0] > 1000) {
          expiryDate = new Date(parts[0], parts[1] - 1, parts[2]);
        } else if (parts[2] > 1000) {
          expiryDate = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
          expiryDate = new Date(`20${parts[2]}`, parts[1] - 1, parts[0]);
        }
        if (expiryDate && expiryDate < new Date()) {
          flags.push(
            `⚠️ ${photo.label} appears EXPIRED (detected date: ${extractedDateStr})`
          );
        } else if (expiryDate) {
          // Flag if expiring within 90 days
          const daysLeft = Math.floor(
            (expiryDate - new Date()) / (1000 * 60 * 60 * 24)
          );
          if (daysLeft < 90) {
            flags.push(
              `⚠️ ${photo.label} expires soon (${daysLeft} days — ${extractedDateStr})`
            );
          }
        }
      }

      // 2. Check if stored license_expiry date is in the past
      if (photo.label === "License" && driver.license_expiry) {
        const storedExpiry = new Date(driver.license_expiry);
        if (storedExpiry < new Date()) {
          flags.push(
            `⚠️ Stored license expiry date (${driver.license_expiry}) is in the past`
          );
        }
      }

      // 3. Low confidence check
      const avgConf = data.words?.length
        ? data.words.reduce((s, w) => s + w.confidence, 0) / data.words.length
        : 0;
      if (avgConf < 40 && data.words?.length > 0) {
        flags.push(
          `⚠️ ${photo.label} image quality is poor (confidence: ${avgConf.toFixed(0)}%)`
        );
      }
    }

    await worker.terminate();

    const ocrResultText = results.join("\n\n---\n\n");
    const ocrFlagsText = flags.length > 0 ? flags.join(" | ") : "✅ No issues detected";

    // Persist OCR results
    await new Promise((resolve, reject) =>
      db.query(
        "UPDATE users SET ocr_result=?, ocr_flags=? WHERE id=?",
        [ocrResultText, ocrFlagsText, driverUserId],
        (err, r) => (err ? reject(err) : resolve(r))
      )
    );

    res.json({
      ok: true,
      ocrResult: ocrResultText,
      ocrFlags: ocrFlagsText,
      flagged: flags.length > 0,
    });
  } catch (err) {
    console.error("OCR error:", err);
    res.status(500).json({ error: err.message || "OCR failed" });
  }
});

// POST /api/admin/drivers/:id/approve
router.post("/drivers/:id/approve", (req, res) => {
  const driverUserId = req.params.id;
  db.query("UPDATE users SET approval_status='approved' WHERE id=? AND role='driver'", [driverUserId], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Driver not found or not a driver" });
    res.json({ message: "Driver approved successfully", id: driverUserId });
  });
});

// POST /api/admin/drivers/:id/reject
router.post("/drivers/:id/reject", (req, res) => {
  const driverUserId = req.params.id;
  db.query("UPDATE users SET approval_status='rejected' WHERE id=? AND role='driver'", [driverUserId], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Driver not found or not a driver" });
    res.json({ message: "Driver rejected", id: driverUserId });
  });
});

// GET /api/admin/users
router.get("/users", (req, res) => {
  db.query(
    "SELECT id, name, email, phone, role, approval_status, createdAt FROM users ORDER BY createdAt DESC",
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows || []);
    }
  );
});

// GET /api/admin/trip-history
router.get("/trip-history", (req, res) => {
  db.query(
    `SELECT rr.id, rr.status, rr.payment_method, rr.payment_status,
            rr.lat, rr.lng, rr.created_at,
            u1.name AS patient_name, u1.email AS patient_email,
            u2.name AS driver_name, u2.vehicle_name
     FROM ride_requests rr
     LEFT JOIN users u1 ON u1.id = rr.user_id
     LEFT JOIN users u2 ON u2.id = rr.accepted_by
     ORDER BY rr.created_at DESC
     LIMIT 200`,
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows || []);
    }
  );
});

// POST /api/admin/create-admin
router.post("/create-admin", async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Missing required fields" });

  try {
    db.query('SELECT * FROM users WHERE email=?', [email], async (err, rows) => {
      if (err) return res.status(500).json(err);
      if (rows.length > 0) return res.status(400).json({ error: "Email already exists" });

      const hash = await bcrypt.hash(password, 10);
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      db.query(
        "INSERT INTO users (name, email, phone, password, role, approval_status, token) VALUES (?, ?, ?, ?, 'admin', 'approved', ?)",
        [name, email, phone || '', hash, 'admin', token],
        (err, result) => {
          if (err) return res.status(500).json(err);
          res.json({ message: "Admin created successfully", id: result.insertId });
        }
      );
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/reports/csv — Download trip data as CSV
router.get("/reports/csv", async (req, res) => {
  try {
    const { Parser } = await import("json2csv");
    const rows = await new Promise((resolve, reject) =>
      db.query(
        `SELECT rr.id, rr.status, rr.payment_method, rr.payment_status, rr.created_at,
                u1.name AS patient_name, u1.email AS patient_email,
                u2.name AS driver_name, u2.email AS driver_email,
                u2.vehicle_name, u2.vehicle_type
         FROM ride_requests rr
         LEFT JOIN users u1 ON u1.id = rr.user_id
         LEFT JOIN users u2 ON u2.id = rr.accepted_by
         ORDER BY rr.created_at DESC LIMIT 2000`,
        (err, r) => (err ? reject(err) : resolve(r))
      )
    );

    const fields = [
      { label: 'Trip ID', value: 'id' },
      { label: 'Status', value: 'status' },
      { label: 'Payment Method', value: 'payment_method' },
      { label: 'Payment Status', value: 'payment_status' },
      { label: 'Created At', value: 'created_at' },
      { label: 'Patient Name', value: 'patient_name' },
      { label: 'Patient Email', value: 'patient_email' },
      { label: 'Driver Name', value: 'driver_name' },
      { label: 'Driver Email', value: 'driver_email' },
      { label: 'Vehicle', value: 'vehicle_name' },
      { label: 'Vehicle Type', value: 'vehicle_type' },
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="ambutrack-report-${date}.csv"`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  } catch (err) {
    console.error('CSV report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/reports/pdf — Download summary report as PDF
router.get("/reports/pdf", async (req, res) => {
  try {
    const PDFDocument = (await import("pdfkit")).default;

    // Fetch data
    const [trips, driverStats, earningsStats] = await Promise.all([
      new Promise((resolve, reject) =>
        db.query(
          `SELECT rr.id, rr.status, rr.payment_method, rr.created_at, u1.name AS patient, u2.name AS driver
           FROM ride_requests rr
           LEFT JOIN users u1 ON u1.id = rr.user_id
           LEFT JOIN users u2 ON u2.id = rr.accepted_by
           ORDER BY rr.created_at DESC LIMIT 50`,
          (err, r) => (err ? reject(err) : resolve(r))
        )
      ),
      new Promise((resolve, reject) =>
        db.query(
          `SELECT u.name, u.email, d.rating, d.completed_trips, d.total_earnings
           FROM drivers d JOIN users u ON d.user_id = u.id
           ORDER BY d.total_earnings DESC LIMIT 20`,
          (err, r) => (err ? reject(err) : resolve(r))
        )
      ),
      new Promise((resolve, reject) =>
        db.query(
          `SELECT 
            COUNT(*) AS total_trips,
            SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN payment_status='paid' THEN 1 ELSE 0 END) AS paid_trips
           FROM ride_requests`,
          (err, r) => (err ? reject(err) : resolve(r))
        )
      ),
    ]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Disposition', `attachment; filename="ambutrack-report-${new Date().toISOString().slice(0,10)}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    // --- Header ---
    doc.fontSize(22).fillColor('#c62828').text('AmbuTrack', { align: 'center' });
    doc.fontSize(13).fillColor('#333').text('System Operations Report', { align: 'center' });
    doc.fontSize(10).fillColor('#888').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    // --- Summary Stats ---
    const s = earningsStats[0] || {};
    doc.fontSize(14).fillColor('#111').text('System Summary', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#333');
    doc.text(`Total Trips: ${s.total_trips || 0}`);
    doc.text(`Completed Trips: ${s.completed || 0}`);
    doc.text(`Paid Trips: ${s.paid_trips || 0}`);
    doc.moveDown(1);

    // --- Driver Performance ---
    doc.fontSize(14).fillColor('#111').text('Driver Performance (Top 20)', { underline: true });
    doc.moveDown(0.4);
    if (driverStats.length === 0) {
      doc.fontSize(11).fillColor('#888').text('No driver data available.');
    } else {
      const colW = [200, 80, 90, 100];
      const headers = ['Name', 'Rating', 'Trips', 'Earnings (Rs)'];
      let x = 50;
      doc.fontSize(10).fillColor('#555').font('Helvetica-Bold');
      headers.forEach((h, i) => { doc.text(h, x, doc.y, { width: colW[i], continued: i < headers.length - 1 }); x += colW[i]; });
      doc.moveDown(0.3);
      doc.font('Helvetica').fillColor('#222');
      driverStats.forEach(d => {
        let xi = 50;
        const y = doc.y;
        const row = [d.name || '-', String(d.rating || '5.0'), String(d.completed_trips || 0), String(Number(d.total_earnings || 0).toFixed(2))];
        row.forEach((v, i) => { doc.text(v, xi, y, { width: colW[i], continued: i < row.length - 1 }); xi += colW[i]; });
        doc.moveDown(0.3);
      });
    }
    doc.moveDown(1);

    // --- Recent Trips ---
    doc.fontSize(14).fillColor('#111').text('Recent Trip Log (Last 50)', { underline: true });
    doc.moveDown(0.4);
    if (trips.length === 0) {
      doc.fontSize(11).fillColor('#888').text('No trips recorded yet.');
    } else {
      doc.fontSize(9).fillColor('#333');
      trips.forEach(t => {
        doc.text(
          `#${t.id} | ${new Date(t.created_at).toLocaleDateString()} | ${t.status} | Patient: ${t.patient || '—'} | Driver: ${t.driver || '—'} | Pay: ${t.payment_method || 'N/A'}`,
          { lineGap: 2 }
        );
      });
    }

    doc.end();
  } catch (err) {
    console.error('PDF report error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

export default router;