import express from "express";
import db from "../config/db.js";

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
    "SELECT id, name, email, phone, role, approval_status, vehicle_name, vehicle_type, createdAt FROM users WHERE role='driver' AND approval_status='pending' ORDER BY createdAt DESC",
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows || []);
    }
  );
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

export default router;