import express from "express";
import db from "../config/db.js";
import bcrypt from "bcrypt";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  const insertUser = async () => {
    const hashed = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)";
    db.query(sql, [name, email, hashed, role], (err) => {
      if (err) return res.status(500).json(err);
      if (role === 'driver' && global.io) {
        // Find all connected admins and notify them
        const registry = global.io.registry || {};
        Object.keys(registry).forEach(sid => {
          if (registry[sid]?.role === 'admin') {
            global.io.to(sid).emit('new_driver_pending', { name, email });
          }
        });
      }
      res.json({ message: "User Registered" });
    });
  };

  if (role === 'admin') {
    const token = req.headers['x-auth-token'];
    if (!token) return res.status(403).json("Admin Token required to register an admin");
    db.query("SELECT id FROM users WHERE token=? AND role='admin'", [token], (err, rows) => {
      if (err || !rows.length) return res.status(403).json("Forbidden: Only existing admins can create new admins");
      insertUser();
    });
  } else {
    insertUser();
  }
});

router.post("/login", (req, res) => {

  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email=?",
    [email],
    async (err, result) => {

      if (result.length === 0)
        return res.status(400).json("User not found");

      const user = result[0];

      const valid = await bcrypt.compare(password, user.password);

      if (!valid)
        return res.status(400).json("Wrong password");

      res.json(user);

    }
  );

});

// --- Password Reset Flows ---

// Temporary in-memory store for reset OTPs: email -> { otp, expiresAt }
// In production, this should be in Redis or DB.
const resetTokens = new Map();

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  db.query("SELECT id, name FROM users WHERE email=?", [email], async (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!rows.length) return res.status(404).json({ error: "Account with that email not found." });

    const user = rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    resetTokens.set(email, { otp, expiresAt });

    const html = `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px">
        <h2 style="color:#0ea5e9;">Password Reset</h2>
        <p>Hi ${user.name},</p>
        <p>You requested a password reset. Here is your 6-digit code:</p>
        <div style="font-size:24px;font-weight:bold;letter-spacing:4px;color:#1e293b;background:#f8fafc;padding:12px;text-align:center;border-radius:8px">${otp}</div>
        <p style="color:#64748b;font-size:12px;margin-top:20px">This code expires in 10 minutes.</p>
      </div>
    `;

    try {
      if (global.mailTransporter) {
        await global.mailTransporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: "AmbuTrack - Password Reset Code",
          html
        });
        res.json({ message: "Reset code sent to your email." });
      } else {
        console.log(`[DEV ONLY] Password Reset OTP for ${email}: ${otp}`);
        res.json({ message: "Reset code generated (check console in Dev)." });
      }
    } catch (sendErr) {
      console.error(sendErr);
      res.status(500).json({ error: "Failed to send email." });
    }
  });
});

router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: "Missing required fields" });

  const record = resetTokens.get(email);
  if (!record || record.otp !== otp || Date.now() > record.expiresAt) {
    return res.status(400).json({ error: "Invalid or expired reset code." });
  }

  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    db.query("UPDATE users SET password=? WHERE email=?", [hashed, email], (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });
      resetTokens.delete(email); // Invalidate OTP
      res.json({ message: "Password updated successfully." });
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to process request." });
  }
});

export default router;