import express from "express";
import mysql from "mysql2";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import multer from "multer";
import path from "path";
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import adminRoutes from "./routes/adminRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import sosRoutes from "./routes/sosRoutes.js";
import authRoutes from "./routes/authRoutes.js"; // New Import
import { sendSMS } from "./services/twilio.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve static frontend assets
const distPath = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath));

/* Multer Storage Configuration */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });
const server = http.createServer(app);

const io = new Server(server,{
cors:{
origin:"*"
}
});

// expose io globally so route modules can emit events to sockets
global.io = io;
app.set('socketio', io);

app.use("/api/admin", adminRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/trip", tripRoutes);
app.use("/api/chat", chatRoutes);
app.use('/api/sos', sosRoutes);
app.use("/api", authRoutes);

/* MySQL Connection */

const db = mysql.createPool({

host:process.env.DB_HOST,
user:process.env.DB_USER,
password:process.env.DB_PASSWORD,
database:process.env.DB_NAME

});

console.log("MySQL Pool Created");


// create mail transporter only when SMTP env vars provided
let mailTransporter = null;
let devMailTransporter = null;
// Configure mail transporter when SMTP credentials provided. Supports explicit host or Gmail account.
if(process.env.SMTP_USER && process.env.SMTP_PASS){
	try{
		if(process.env.SMTP_HOST){
			mailTransporter = nodemailer.createTransport({
				host: process.env.SMTP_HOST,
				port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
				secure: process.env.SMTP_SECURE === 'true',
				auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
			});
		}else if((process.env.SMTP_USER||'').endsWith('@gmail.com')){
			// Gmail: use secure SMTP by default (requires app password or OAuth)
			mailTransporter = nodemailer.createTransport({
				host: 'smtp.gmail.com',
				port: 465,
				secure: true,
				auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
			});
		}
		if(mailTransporter) {
			console.log('Mail transporter configured');
			global.mailTransporter = mailTransporter; // Expose globally
		}
	}catch(e){
		console.log('Failed to configure mail transporter', e);
		mailTransporter = null;
	}
}

// Ensure required tables exist (execute separately to avoid SQL parser issues)
const createUsersTable = `CREATE TABLE IF NOT EXISTS users (
	id INT PRIMARY KEY AUTO_INCREMENT,
	name VARCHAR(255),
	email VARCHAR(255) UNIQUE,
	password VARCHAR(255),
	role VARCHAR(50) DEFAULT 'patient',
	token VARCHAR(255)
);`;

const createAmbulancesTable = `CREATE TABLE IF NOT EXISTS ambulances (
	id INT PRIMARY KEY AUTO_INCREMENT,
	driver VARCHAR(255),
	lat DOUBLE,
	lng DOUBLE,
	status VARCHAR(255)
);`;

const createDriversTable = `CREATE TABLE IF NOT EXISTS drivers (
	id INT PRIMARY KEY AUTO_INCREMENT,
	name VARCHAR(255),
	phone VARCHAR(64),
	lat DOUBLE,
	lng DOUBLE,
	status VARCHAR(50) DEFAULT 'offline',
	completed_trips INT DEFAULT 0
);`;

const createTripsTable = `CREATE TABLE IF NOT EXISTS trips (
	id INT PRIMARY KEY AUTO_INCREMENT,
	patient_id INT,
	driver_id INT,
	status VARCHAR(50) DEFAULT 'requesting',
	patient_lat DOUBLE,
	patient_lng DOUBLE,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	started_at DATETIME NULL,
	completed_at DATETIME NULL
);`;

const createRideRequestsTable = `CREATE TABLE IF NOT EXISTS ride_requests (
	id INT PRIMARY KEY AUTO_INCREMENT,
	user_id INT,
	lat DOUBLE,
	lng DOUBLE,
	status VARCHAR(50) DEFAULT 'pending',
	accepted_by INT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

const createOtpsTable = `CREATE TABLE IF NOT EXISTS otps (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255),
    code VARCHAR(10),
    expires_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

const createTransactionsTable = `CREATE TABLE IF NOT EXISTS transactions (
	id INT PRIMARY KEY AUTO_INCREMENT,
	user_id INT,
	amount DECIMAL(10,2),
	type ENUM('credit', 'debit'),
	description VARCHAR(255),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

// --- DATABASE INITIALIZATION & MIGRATIONS ---
const initDB = async () => {
    const query = (sql, params = []) => new Promise((resolve, reject) => {
        db.query(sql, params, (err, res) => err ? reject(err) : resolve(res));
    });

    try {
        console.log('Starting Database Initialization...');
        
        // 1. Create Tables
        const createTables = [
            { name: 'users', sql: createUsersTable },
            { name: 'drivers', sql: createDriversTable },
            { name: 'ambulances', sql: createAmbulancesTable },
            { name: 'trips', sql: createTripsTable },
            { name: 'ride_requests', sql: createRideRequestsTable },
            { name: 'otps', sql: createOtpsTable },
            { name: 'transactions', sql: createTransactionsTable }
        ];

        for (const t of createTables) {
            await query(t.sql);
            console.log(`${t.name} table ok`);
        }

        // 2. Schema Evolution (Alters) - Sequential to avoid deadlocks
        const alters = [
            "ALTER TABLE drivers ADD COLUMN rating DECIMAL(3,1) DEFAULT 5.0",
            "ALTER TABLE drivers ADD COLUMN total_earnings DECIMAL(10,2) DEFAULT 0.00",
            "ALTER TABLE drivers ADD COLUMN online_since DATETIME NULL",
            "ALTER TABLE trips ADD COLUMN destination_lat DOUBLE NULL",
            "ALTER TABLE trips ADD COLUMN destination_lng DOUBLE NULL",
            "ALTER TABLE trips ADD COLUMN distance_km DECIMAL(6,2) NULL",
            "ALTER TABLE trips ADD COLUMN fare DECIMAL(10,2) NULL",
            "ALTER TABLE ride_requests ADD COLUMN name VARCHAR(255) NULL",
            "ALTER TABLE users ADD COLUMN phone VARCHAR(64) NULL",
            "ALTER TABLE users ADD COLUMN address TEXT NULL",
            "ALTER TABLE users ADD COLUMN vehicle_number VARCHAR(100) NULL",
            "ALTER TABLE users ADD COLUMN vehicle_model VARCHAR(255) NULL",
            "ALTER TABLE users ADD COLUMN license_number VARCHAR(100) NULL",
            "ALTER TABLE users ADD COLUMN license_expiry DATE NULL",
            "ALTER TABLE users ADD COLUMN license_photo VARCHAR(255) NULL",
            "ALTER TABLE users ADD COLUMN nid_number VARCHAR(100) NULL",
            "ALTER TABLE users ADD COLUMN nid_photo VARCHAR(255) NULL",
            "ALTER TABLE users ADD COLUMN wallet_balance DECIMAL(10,2) DEFAULT 0.00",
            "ALTER TABLE users ADD COLUMN avatar LONGTEXT NULL",
            "ALTER TABLE users ADD COLUMN twofa_enabled BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN approval_status VARCHAR(50) DEFAULT 'pending'",
            "ALTER TABLE users ADD COLUMN vehicle_name VARCHAR(255) NULL",
            "ALTER TABLE users ADD COLUMN vehicle_type VARCHAR(100) NULL",
            "ALTER TABLE users ADD COLUMN base_fare DECIMAL(10,2) NULL",
            "ALTER TABLE users ADD COLUMN per_km_rate DECIMAL(10,2) NULL",
            "ALTER TABLE ride_requests ADD COLUMN requested_driver_id INT NULL",
            "ALTER TABLE ride_requests ADD COLUMN payment_method VARCHAR(50) NULL",
            "ALTER TABLE ride_requests ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending'",
            "ALTER TABLE users ADD COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE users ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
            "ALTER TABLE users MODIFY createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE users MODIFY updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
            "ALTER TABLE users ADD COLUMN ocr_result LONGTEXT NULL",
            "ALTER TABLE users ADD COLUMN ocr_flags TEXT NULL",
            "ALTER TABLE ride_requests ADD COLUMN medical_note TEXT NULL",
            "ALTER TABLE users ADD COLUMN medical_history TEXT NULL",
            "ALTER TABLE ride_requests ADD COLUMN otp VARCHAR(10) NULL",
            // CRITICAL FIXES FOR EXISTING ERRORS
            "ALTER TABLE notifications ADD COLUMN user_id INT NOT NULL",
            "ALTER TABLE trips ADD COLUMN patient_lat DOUBLE",
            "ALTER TABLE trips ADD COLUMN patient_lng DOUBLE",
            // NEW FEATURE SUPPORT
            "ALTER TABLE ride_requests ADD COLUMN destination_lat DOUBLE NULL",
            "ALTER TABLE ride_requests ADD COLUMN destination_lng DOUBLE NULL"
        ];

        for (const stmt of alters) {
            try {
                await query(stmt);
            } catch (err) {
                // Ignore duplicate column errors or duplicate key name errors
                if (!/Duplicate column/i.test(err.message) && !/Duplicate key name/i.test(err.message)) {
                // Success, no log needed per migration loop
                }
            }
        }

        // 3. Duplicate Index Cleanup
        try {
            const rows = await query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email'", [process.env.DB_NAME]);
            const idxs = rows.map(r => r.INDEX_NAME).filter(n => n && n !== 'PRIMARY');
            if (idxs.length > 1) {
                const toDrop = idxs.slice(1);
                for (const name of toDrop) {
                    await query(`ALTER TABLE users DROP INDEX \`${name}\``).catch(() => {});
                }
                console.log('Dropped duplicate email indexes:', toDrop);
            }
        } catch (e) {}

        // 4. Legacy Column Removal
        try {
            const cols = await query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND COLUMN_NAME='passwordHash'", [process.env.DB_NAME]);
            if (cols && cols.length) {
                await query('ALTER TABLE users DROP COLUMN passwordHash');
                console.log('Dropped legacy passwordHash column');
            }
        } catch (e) {}

        console.log('Database Initialization & Migrations Completed Successfully');
    } catch (err) {
        console.error('CRITICAL DATABASE INITIALIZATION ERROR:', err);
    }
};

// initDB(); // Moved to startServer callback for stability



/* Register */
// Send OTP for registration (dev: returns OTP in response for testing)
app.post('/api/send-otp', (req, res) => {
	try{
		const { email } = req.body;
		if(!email) return res.status(400).send('Missing email');
		const code = String(Math.floor(100000 + Math.random() * 900000));
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
		db.query('INSERT INTO otps(email,code,expires_at) VALUES(?,?,?)',[email, code, expiresAt], (err)=>{
			if(err) return res.status(500).send(err);
			// Prepare email content
			const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || `AmbuTrack <no-reply@ambutrack.local>`;
			const subject = 'AmbuTrack — Your One Time Passcode (OTP)';
			const html = `
				<div style="font-family:Inter, system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial; color:#111;">
				  <div style="max-width:680px;margin:0 auto;padding:20px;background:#fff;border-radius:12px;border:1px solid #f0f0f0">
					<h2 style="margin:0 0 10px;color:#c62828">AmbuTrack</h2>
					<p style="margin:0 0 18px;color:#444">Use the one-time passcode below to complete your action. This code expires in 5 minutes.</p>
					<div style="display:flex;align-items:center;justify-content:center;padding:18px 12px;margin:12px 0;background:linear-gradient(90deg,#fff7f7,#fff);border-radius:10px">
					  <div style="font-size:28px;letter-spacing:6px;font-weight:700;color:#222">${code}</div>
					</div>
					<p style="color:#666;margin-top:6px">If you didn't request this, you can safely ignore this email.</p>
					<hr style="border:none;border-top:1px solid #f2f2f2;margin:14px 0" />
					<div style="font-size:12px;color:#999">AmbuTrack Team</div>
				  </div>
				</div>
			`;

			// helper to send using a transporter and return preview when available
			const doSend = async (transporter) => {
				return new Promise((resolve) => {
					transporter.sendMail({ from: fromAddress, to: email, subject, html }, (mailErr, info) => {
						if(mailErr){
							console.log('OTP email error', mailErr);
							return resolve({ success:false, error: String(mailErr) });
						}
						const preview = nodemailer.getTestMessageUrl(info) || null;
						return resolve({ success:true, preview });
					});
				});
			};


			
			(async ()=>{
				// prefer configured SMTP transporter
				if(mailTransporter){
					const r = await doSend(mailTransporter);
					if(!r.success){
						// in case of error, fall back to dev ethereal in non-production
						if(process.env.NODE_ENV !== 'production'){
							try{
								const testAcc = await nodemailer.createTestAccount();
								devMailTransporter = nodemailer.createTransport({ host: testAcc.smtp.host, port: testAcc.smtp.port, secure: testAcc.smtp.secure, auth: { user: testAcc.user, pass: testAcc.pass } });
								const r2 = await doSend(devMailTransporter);
								if(r2.success) return res.send({ ok:true, expiresAt, emailed:true, preview: r2.preview });
							}catch(e){ console.log('dev ethereal fallback failed', e); }
						}
						return res.send({ ok:true, expiresAt, emailed:false, error: r.error });
					}
					return res.send({ ok:true, expiresAt, emailed:true, preview: r.preview });
				}

				// No SMTP configured: in non-production attempt Ethereal test account to simulate real email sending
				if(process.env.NODE_ENV !== 'production'){
					try{
						const testAccount = await nodemailer.createTestAccount();
						devMailTransporter = nodemailer.createTransport({ host: testAccount.smtp.host, port: testAccount.smtp.port, secure: testAccount.smtp.secure, auth: { user: testAccount.user, pass: testAccount.pass } });
						const r = await doSend(devMailTransporter);
						if(r.success) return res.send({ ok:true, expiresAt, emailed:true, preview: r.preview });
						return res.send({ ok:true, expiresAt, emailed:false, error: r.error });
					}catch(e){ console.log('Ethereal setup failed', e); return res.send({ ok:true, expiresAt, emailed:false, error: String(e) }); }
				}

				// Production and no SMTP configured: do not return OTP, report not emailed
				return res.send({ ok:true, expiresAt, emailed:false, message:'SMTP not configured' });
			})();
		});
	}catch(e){ res.status(500).send('Error') }
});

// GET user wallet balance
app.get('/api/user/wallet', (req, res) => {
	const token = req.headers['x-auth-token'];
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT wallet_balance AS balance FROM users WHERE token=?', [token], (err, r) => {
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		res.send({ balance: r[0].balance || 0 });
	});
});

// Recharge wallet (Mock)
app.post('/api/user/wallet/recharge', (req, res) => {
	const token = req.headers['x-auth-token'];
	const { amount } = req.body;
	if(!token) return res.status(401).send('Unauthorized');
	if(!amount || amount <= 0) return res.status(400).send('Invalid amount');
	
	db.query('UPDATE users SET wallet_balance = wallet_balance + ? WHERE token=?', [amount, token], (err, result) => {
		if(err) return res.status(500).send(err);
		res.send({ ok: true, message: 'Wallet recharged successfully' });
	});
});

// Register using OTP and handling file uploads
app.post("/api/register", upload.fields([{ name: 'licensePhoto', maxCount: 1 }, { name: 'nidPhoto', maxCount: 1 }]), async (req,res)=>{
	try{
		const {name, email, password, role, otp, phone, address, vehicleNumber, vehicleModel, vehicleType, licenseNumber, licenseExpiry, nidNumber} = req.body;
		if(!email || !password || !otp) return res.status(400).send('Missing required fields or OTP');

		// Admin-to-Admin creation bypass: If a valid admin token is provided, skip OTP check
		const adminToken = req.headers['x-auth-token'];
		let isAdminCreation = false;
		if (role === 'admin' && adminToken) {
			const adminRows = await new Promise(resolve => db.query('SELECT role FROM users WHERE token=?', [adminToken], (e, r) => resolve(r)));
			if (adminRows && adminRows.length > 0 && adminRows[0].role === 'admin') {
				isAdminCreation = true;
			}
		}

		if(role === 'admin' && !isAdminCreation) return res.status(403).send('Admin registration is restricted');

		const licensePhoto = req.files['licensePhoto'] ? `/uploads/${req.files['licensePhoto'][0].filename}` : null;
		const nidPhoto = req.files['nidPhoto'] ? `/uploads/${req.files['nidPhoto'][0].filename}` : null;

		const registerUser = async () => {
			const hash = await bcrypt.hash(password, 10);
			const status = (role === 'driver') ? 'pending' : 'approved';
			const initialBalance = (role === 'patient') ? 0.00 : 0.00; // Requirement: Initial Wallet Balance (default = 0)
			
			const sql = `INSERT INTO users (
				name, email, password, role, approval_status, phone, address, 
				vehicle_number, vehicle_model, vehicle_type, 
				license_number, license_expiry, license_photo, 
				nid_number, nid_photo, wallet_balance
			) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

			const params = [
				name, email, hash, role || 'patient', status, phone || null, address || null,
				vehicleNumber || null, vehicleModel || null, vehicleType || null,
				licenseNumber || null, licenseExpiry || null, licensePhoto,
				nidNumber || null, nidPhoto, initialBalance
			];

			db.query(sql, params, (e, result) => {
				if(e) {
					console.error('Registration DB error:', e);
					return res.status(500).send(e.sqlMessage || 'Database error');
				}
				if(role === 'driver' && global.io){
					const registry = global.io.registry || {};
					Object.keys(registry).forEach(sid => {
						if (registry[sid]?.role === 'admin') {
							global.io.to(sid).emit('new_driver_pending', { name, email });
						}
					});
				}
				res.send({ message: 'Registered successfully', id: result.insertId });
			});
		};

		if (isAdminCreation) {
			return registerUser();
		}

		// verify OTP
		db.query('SELECT * FROM otps WHERE email=? AND code=? AND used=0 AND expires_at>NOW() ORDER BY id DESC LIMIT 1',[email, otp], async (err, rows)=>{
			if(err) return res.status(500).send(err);
			if(!rows || !rows.length) return res.status(400).send('Invalid or expired OTP');
			const otpEntry = rows[0];
			db.query('UPDATE otps SET used=1 WHERE id=?',[otpEntry.id]);
			registerUser();
		});
	}catch(e){ 
		console.error('Registration error:', e);
		res.status(500).send('Internal Server Error');
	}
});



/* Login */

app.post('/api/login', (req,res)=>{
	const { email, password } = req.body;
	if(!email || !password) return res.status(400).send('Missing');
	db.query('SELECT * FROM users WHERE email=?',[email], async (err, result)=>{
		if(err) return res.status(500).send(err);
		if(!result.length) return res.status(401).send('Invalid');
		const user = result[0];
		// support legacy 'passwordHash' column if present
		const hash = user.password || user.passwordHash || '';
		const ok = await bcrypt.compare(password, hash);
		if(!ok) return res.status(401).send('Invalid');
		// If user has two-factor enabled, generate OTP and do not issue token yet
		if(user.twofa_enabled){
			const code = String(Math.floor(100000 + Math.random() * 900000));
			const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
			db.query('INSERT INTO otps(email,code,expires_at) VALUES(?,?,?)',[email, code, expiresAt], (e)=>{
				if(e) console.log('otp insert err', e);
				if(mailTransporter){
					const msg = `Your AmbuTrack login OTP is ${code}. It expires in 5 minutes.`;
					mailTransporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject: 'AmbuTrack login OTP', text: msg, html:`<p>${msg}</p>` }, (mErr)=>{
						if(mErr){ console.log('login OTP email failed', mErr); return res.send({ twofa:true, message:'OTP generated', emailed:false }); }
						return res.send({ twofa:true, message:'OTP sent', emailed:true });
					});
				}else{
					// for dev/testing return OTP
					return res.send({ twofa:true, message:'OTP generated', otp: code });
				}
			});
			return;
		}
		const token = uuidv4();
		db.query('UPDATE users SET token=? WHERE id=?',[token, user.id]);
		// avoid sending password fields
		delete user.password;
		delete user.passwordHash;
		user.token = token;
		// only expose safe fields
		const safe = { id: user.id, name: user.name, email: user.email, role: user.role, token, approval_status: user.approval_status };
		res.send(safe);
	});
});

// Verify OTP for login and issue token
app.post('/api/login-verify', (req, res) => {
	const { email, otp } = req.body;
	if(!email || !otp) return res.status(400).send('Missing');
	db.query('SELECT * FROM otps WHERE email=? AND code=? AND used=0 AND expires_at>NOW() ORDER BY id DESC LIMIT 1',[email, otp], (err, rows)=>{
		if(err) return res.status(500).send(err);
		if(!rows || !rows.length) return res.status(400).send('Invalid or expired OTP');
		const otpEntry = rows[0];
		// mark used
		db.query('UPDATE otps SET used=1 WHERE id=?',[otpEntry.id]);
		// issue token
		db.query('SELECT * FROM users WHERE email=?',[email], (e, r)=>{
			if(e) return res.status(500).send(e);
			if(!r.length) return res.status(401).send('Invalid');
			const user = r[0];
			const token = uuidv4();
			db.query('UPDATE users SET token=? WHERE id=?',[token, user.id]);
			const safe = { id: user.id, name: user.name, email: user.email, role: user.role, token, approval_status: user.approval_status };
			res.send(safe);
		});
	});
});

// --- Password Reset Flows ---

const resetTokens = new Map();

app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  db.query("SELECT id, name FROM users WHERE email=?", [email], async (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!rows.length) return res.status(404).json({ error: "Account with that email not found." });

    const user = rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

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
        res.json({ message: "Reset code generated (check console securely in Dev)." });
      }
    } catch (sendErr) {
      console.error(sendErr);
      res.status(500).json({ error: "Failed to send email." });
    }
  });
});

app.post("/api/auth/reset-password", async (req, res) => {
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
      resetTokens.delete(email); 
      res.json({ message: "Password updated successfully." });
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to process request." });
  }
});

// Get current authenticated user profile
app.get('/api/user/profile', (req, res) => {
	const token = req.headers['x-auth-token'];
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT id, name, email, role, phone, address, wallet_balance, twofa_enabled, approval_status, avatar, medical_history FROM users WHERE token=?',[token], (err, r)=>{
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		res.send(r[0]);
	});
});

// Toggle two-factor for authenticated user
app.post('/api/user/2fa', (req, res) => {
	const token = req.headers['x-auth-token'] || req.body.token;
	const enable = !!req.body.enable;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		const user = r[0];
		db.query('UPDATE users SET twofa_enabled=? WHERE id=?',[enable?1:0, user.id], (e)=>{
			if(e) return res.status(500).send(e);
			res.send({ ok:true, twofa: enable });
		});
	});
});

// Update profile (name, phone, avatar, medical_history)
app.post('/api/user/update', (req, res) => {
	const token = req.headers['x-auth-token'] || req.body.token;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		const user = r[0];
		const { name, phone, avatar, medical_history } = req.body || {};
		db.query('UPDATE users SET name=?, phone=?, avatar=?, medical_history=? WHERE id=?',[name||user.name, phone||user.phone, avatar||user.avatar, medical_history||user.medical_history, user.id], (e)=>{
			if(e) return res.status(500).send(e);
			res.send({ ok:true });
		});
	});
});

// Change password (authenticated)
app.post('/api/user/change-password', async (req, res) => {
	const token = req.headers['x-auth-token'] || req.body.token;
	if(!token) return res.status(401).send('Unauthorized');
	
	const { currentPassword, newPassword } = req.body;
	if(!currentPassword || !newPassword) return res.status(400).send('Missing passwords');

	db.query('SELECT * FROM users WHERE token=?',[token], async (err, r)=>{
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		const user = r[0];

		// Verify current password
		const hash = user.password || user.passwordHash || '';
		const isMatch = await bcrypt.compare(currentPassword, hash);
		if(!isMatch) return res.status(400).send('Incorrect current password');

		// Hash new password and update
		const newHash = await bcrypt.hash(newPassword, 10);
		db.query('UPDATE users SET password=? WHERE id=?', [newHash, user.id], (e2)=>{
			if(e2) return res.status(500).send(e2);
			res.send({ ok:true, message: 'Password changed successfully' });
		});
	});
});

// Delete account (authenticated)
app.delete('/api/user', (req, res) => {
	const token = req.headers['x-auth-token'] || req.body.token;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		const user = r[0];
		// remove user and related driver/records (best-effort)
		db.query('DELETE FROM users WHERE id=?',[user.id], (e)=>{
			if(e) return res.status(500).send(e);
			db.query('DELETE FROM drivers WHERE user_id=?',[user.id], ()=>{});
			db.query('DELETE FROM ride_requests WHERE user_id=?',[user.id], ()=>{});
			res.send({ ok:true });
		});
	});
});

// GET active drivers for patient to view on map
app.get('/api/patient/drivers', (req, res) => {
	const token = req.headers['x-auth-token'];
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT role FROM users WHERE token=?',[token], (err, r)=>{
		if(err || !r.length || r[0].role !== 'patient') return res.status(403).send('Forbidden');
		db.query(
			`SELECT d.id AS driver_id, d.user_id AS driver_user_id, d.lat, d.lng, d.status, d.rating, u.name, u.vehicle_name, u.vehicle_type, u.base_fare, u.per_km_rate 
       FROM drivers d JOIN users u ON d.user_id = u.id 
       WHERE d.status='online' AND u.approval_status='approved'`, 
			(e2, r2)=>{
			if(e2) return res.status(500).send(e2);
			res.json(r2 || []);
		});
	});
});

// create ride request via REST (authenticated by token)
app.post('/api/ride-request', (req,res)=>{
	const token = req.headers['x-auth-token'] || req.body.token;
	const { lat, lng, destination_lat, destination_lng, driver_user_id } = req.body;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		const user = r[0];
		// only patients may create ride requests
		if(user.role !== 'patient') return res.status(403).send('Forbidden');
		
		const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
		
		let insertSql, insertParams;
		if (driver_user_id) {
			insertSql = 'INSERT INTO ride_requests(user_id,lat,lng,destination_lat,destination_lng,name,requested_driver_id,otp) VALUES(?,?,?,?,?,?,?,?)';
			insertParams = [user.id, lat, lng, destination_lat || null, destination_lng || null, user.name || 'Patient', driver_user_id, otp];
		} else {
			insertSql = 'INSERT INTO ride_requests(user_id,lat,lng,destination_lat,destination_lng,name,otp) VALUES(?,?,?,?,?,?,?)';
			insertParams = [user.id, lat, lng, destination_lat || null, destination_lng || null, user.name || 'Patient', otp];
		}

		db.query(insertSql, insertParams, (e, resu)=>{
			if(e) return res.status(500).send(e);
			const id = resu.insertId;
			// broadcast to drivers via sockets
			const registry = io.registry || (io.registry = {});
			Object.keys(registry).forEach(sid=>{ 
				if(registry[sid] && registry[sid].role === 'driver'){
					// If specifically requested, only notify that driver. Otherwise, notify all.
					if(!driver_user_id || registry[sid].userId === driver_user_id) {
						io.to(sid).emit('ride_request', { 
							id, userId:user.id, name: user.name || 'Patient', 
							lat, lng, 
							destination_lat: destination_lat || null, 
							destination_lng: destination_lng || null,
							targeted: !!driver_user_id 
						});
					}
				} 
			});
			res.send({ id, targeted: !!driver_user_id, otp });
		});
	});
});

app.get('/api/ride-requests', (req,res)=>{
	// Only return pending requests from the last 1 minute
	db.query('SELECT rr.*, u.name AS name FROM ride_requests rr LEFT JOIN users u ON u.id=rr.user_id WHERE rr.status="pending" AND rr.created_at > NOW() - INTERVAL 1 MINUTE', (err, r)=>{ if(err) return res.status(500).send(err); res.send(r) });
});

// PATCH /api/ride-request/:id/medical-note — patient adds medical info during wait
app.patch('/api/ride-request/:id/medical-note', (req, res) => {
	const token = req.headers['x-auth-token'];
	const { medical_note } = req.body;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?', [token], (err, r) => {
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		const user = r[0];
		const requestId = req.params.id;
		// Ensure the request belongs to this patient
		db.query('SELECT * FROM ride_requests WHERE id=? AND user_id=?', [requestId, user.id], (e, rows) => {
			if(e) return res.status(500).send(e);
			if(!rows.length) return res.status(404).send('Request not found');
			db.query('UPDATE ride_requests SET medical_note=? WHERE id=?', [medical_note, requestId], (e2) => {
				if(e2) return res.status(500).send(e2);
				// Broadcast updated note to driver who accepted (if any)
				const req_row = rows[0];
				if(req_row.accepted_by && global.io) {
					const registry = global.io.registry || {};
					Object.keys(registry).forEach(sid => {
						if(registry[sid] && registry[sid].userId === req_row.accepted_by) {
							global.io.to(sid).emit('medical_note_update', {
								requestId,
								patientName: user.name,
								medicalNote: medical_note
							});
						}
					});
				}
				// Also broadcast to all drivers who may have this request in their pending list
				if(global.io) {
					const registry = global.io.registry || {};
					Object.keys(registry).forEach(sid => {
						if(registry[sid] && registry[sid].role === 'driver') {
							global.io.to(sid).emit('medical_note_update', { requestId, patientName: user.name, medicalNote: medical_note });
						}
					});
				}
				res.send({ ok: true });
			});
		});
	});
});

// Backend Cleanup: Mark stale requests as timed_out every minute
setInterval(() => {
	db.query("UPDATE ride_requests SET status='timed_out' WHERE status='pending' AND created_at < NOW() - INTERVAL 1 MINUTE");
}, 60000);

// Proxy for OSRM Turn-by-Turn Routing
app.get('/api/route', async (req, res) => {
	const { startLat, startLng, endLat, endLng } = req.query;
	if (!startLat || !startLng || !endLat || !endLng) return res.status(400).json({ error: 'Missing coordinates' });
	try {
		// OSRM format: lon,lat;lon,lat
		const url = `http://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
		// Dynamic import node-fetch if needed, or use native fetch in Node 18+
		const fetch = global.fetch || (await import('node-fetch')).default;
		const response = await fetch(url);
		const data = await response.json();
		res.json(data);
	} catch (e) {
		console.error("OSRM Route Error:", e);
		res.status(500).json({ error: "Routing failed" });
	}
});

// Admin: list all ride requests (requires admin token)
app.get('/api/admin/ride-requests', (req, res) => {
	const token = req.headers['x-auth-token'] || req.query.token;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		const user = r[0];
		if(user.role !== 'admin') return res.status(403).send('Forbidden');
		db.query('SELECT * FROM ride_requests ORDER BY created_at DESC', (e, rows)=>{ if(e) return res.status(500).send(e); res.send(rows) });
	});
});

// Admin: list ambulances (requires admin token)
app.get('/api/admin/ambulances', (req, res) => {
	const token = req.headers['x-auth-token'] || req.query.token;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		const user = r[0];
		if(user.role !== 'admin') return res.status(403).send('Forbidden');
		db.query('SELECT * FROM ambulances', (e, rows)=>{ if(e) return res.status(500).send(e); res.send(rows) });
	});
});

// GET active or unpaid trip for a patient
app.get('/api/patient/active-trip', (req, res) => {
	const token = req.headers['x-auth-token'];
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err || !r.length) return res.status(401).send('Unauthorized');
		const user = r[0];
		// Check for ongoing or completed (but unpaid) ride requests
		db.query(
			"SELECT * FROM ride_requests WHERE user_id=? AND status IN ('accepted', 'arrived', 'started', 'completed') AND (payment_status='pending' OR payment_status IS NULL) ORDER BY created_at DESC LIMIT 1",
			[user.id],
			(e, rows) => {
				if(e) return res.status(500).send(e);
				if(rows && rows.length) return res.send(rows[0]);
				res.send(null);
			}
		);
	});
});

// Admin: list all drivers with detailed status for global tracking
app.get('/api/admin/all-drivers', (req, res) => {
	const token = req.headers['x-auth-token'] || req.query.token;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		const user = r[0];
		if(user.role !== 'admin') return res.status(403).send('Forbidden');
		
		db.query(`
			SELECT u.id, u.name, u.email, u.phone, u.role, u.approval_status, 
			       d.lat, d.lng, d.status, d.vehicle_name, d.vehicle_type, d.rating
			FROM users u 
			LEFT JOIN drivers d ON u.id = d.user_id 
			WHERE u.role='driver'
		`, (e, rows) => {
			if(e) return res.status(500).send(e);
			res.send(rows);
		});
	});
});

// Mail testing endpoint - creates an Ethereal test account and sends a sample email
app.post('/api/mail-test', async (req, res) => {
	try{
		const { to, subject, text } = req.body || {};
		// create ethereal test account
		const testAccount = await nodemailer.createTestAccount();
		const transporter = nodemailer.createTransport({
			host: testAccount.smtp.host,
			port: testAccount.smtp.port,
			secure: testAccount.smtp.secure,
			auth: { user: testAccount.user, pass: testAccount.pass }
		});
		const info = await transporter.sendMail({
			from: process.env.SMTP_FROM || testAccount.user,
			to: to || testAccount.user,
			subject: subject || 'AmbuTrack test email',
			text: text || 'This is a test email from AmbuTrack',
			html: `<p>${text || 'This is a test email from AmbuTrack'}</p>`
		});
		const preview = nodemailer.getTestMessageUrl(info);
		res.send({ ok:true, preview, info: { messageId: info.messageId } });
	}catch(e){
		console.log('mail-test err', e);
		res.status(500).send({ ok:false, error: String(e) });
	}
});

// Cancel ride request (e.g. on timeout or patient change of mind)
app.post('/api/ride-request/:id/cancel', (req, res) => {
	const id = req.params.id;
	// Allow cancellation if the request is pending, accepted, or arrived, but not if trip has started
	db.query('UPDATE ride_requests SET status="cancelled" WHERE id=? AND status IN ("pending", "accepted", "arrived")', [id], (err, result) => {
		if(err) return res.status(500).send(err);
		if(result.affectedRows === 0) return res.status(409).json({ message: 'Unable to cancel (trip already in progress or completed)', status: 'in_progress' });
		
		// Notify the driver (if one accepted) via socket that request was cancelled
		db.query('SELECT accepted_by FROM ride_requests WHERE id=?', [id], (err2, rows) => {
			if(rows && rows[0] && rows[0].accepted_by) {
				const registry = global.io.registry || {};
				Object.keys(registry).forEach(sid => {
					if(registry[sid] && registry[sid].userId === rows[0].accepted_by) {
						global.io.to(sid).emit('ride_cancelled', { id });
					}
				});
			}
		});
		
		res.json({ ok: true });
	});
});

// Process ride payment
app.post('/api/ride-request/:id/pay', (req, res) => {
	const { id } = req.params;
	const { method, amount } = req.body;
	const token = req.headers['x-auth-token'];
	
	if(!token) return res.status(401).send('Unauthorized');
	
	db.query('SELECT * FROM users WHERE token=?', [token], (err, r) => {
		if(err || !r.length) return res.status(401).send('Unauthorized');
		const user = r[0];

		db.query('SELECT * FROM ride_requests WHERE id=?', [id], (err2, r2) => {
			if(err2 || !r2.length) return res.status(404).send('Request not found');
			const ride = r2[0];
			
			// Deduct if from wallet, otherwise just mark as paid
			if(method === 'token' || method === 'wallet'){
				if (user.wallet_balance < amount) return res.status(400).send('Insufficient balance');
				db.query('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id=?', [amount, user.id]);
			}
			
			// Log Transaction
			db.query('INSERT INTO transactions(user_id, amount, type, description) VALUES(?,?,?,?)', 
				[user.id, amount, 'debit', `Payment for Ride #${id}`]);

			// Update payment status
			db.query('UPDATE ride_requests SET payment_status="paid", payment_method=? WHERE id=?', [method, id], (err3) => {
				if(err3) return res.status(500).send(err3);
				
				// Optional: Transfer money to driver (if system handles payouts)
				if (ride.accepted_by) {
					db.query('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id=?', [amount, ride.accepted_by]);
				}
				
				res.send({ ok: true, message: 'Payment successful' });
			});
		});
	});
});

// GET driver earnings
app.get('/api/driver/earnings', (req, res) => {
	const token = req.headers['x-auth-token'];
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT id FROM users WHERE token=? AND role="driver"', [token], (err, r) => {
		if(err || !r.length) return res.status(401).send('Unauthorized');
		const driverUserId = r[0].id;
		
		db.query('SELECT SUM(fare) AS total FROM ride_requests WHERE accepted_by=? AND payment_status="paid"', [driverUserId], (err2, r2) => {
			if(err2) return res.status(500).send(err2);
			res.send({ earnings: r2[0].total || 0 });
		});
	});
});

// Driver Rating
app.post('/api/driver/rate', (req, res) => {
	const { driverId, rating } = req.body;
	if(!driverId || !rating) return res.status(400).send('Missing');
	
	db.query('UPDATE drivers SET rating = (rating + ?) / 2 WHERE user_id=?', [rating, driverId], (err) => {
		if(err) return res.status(500).send(err);
		res.send({ ok: true });
	});
});

// Generate eSewa HMAC Signature (Production/Live Ready)
app.post('/api/payment/esewa/signature', (req, res) => {
  const { amount, transaction_uuid } = req.body;
  if (!amount || !transaction_uuid) return res.status(400).send("Missing parameters");

  const product_code = process.env.ESEWA_MERCHANT_CODE || "EPAYTEST";
  const secret_key = process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q";
  const signed_field_names = "total_amount,transaction_uuid,product_code";
  
  const message = `total_amount=${amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;
  const hash = crypto.createHmac('sha256', secret_key)
                     .update(message)
                     .digest('base64');
                     
  res.send({
    signature: hash,
    signed_field_names,
    product_code
  });
});

// Verify eSewa HMAC Signature from Redirect
app.post('/api/payment/esewa/verify', (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).send("No data");
  try {
    const decodedStr = Buffer.from(data, 'base64').toString('utf-8');
    const decodedData = JSON.parse(decodedStr);
    
    // eSewa returns signature as well. Recompute to verify.
    const secret_key = process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q";
    const msg = `transaction_code=${decodedData.transaction_code},status=${decodedData.status},total_amount=${decodedData.total_amount},transaction_uuid=${decodedData.transaction_uuid},product_code=${process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST'},signed_field_names=${decodedData.signed_field_names}`;
    
    const hash = crypto.createHmac('sha256', secret_key).update(msg).digest('base64');
    
    if (hash === decodedData.signature && decodedData.status === 'COMPLETE') {
      const txUuid = decodedData.transaction_uuid;
      
      // If it's a wallet recharge, update the balance immediately
      if (txUuid.startsWith('recharge_')) {
        const parts = txUuid.split('_');
        const userId = parts[1];
        const amount = parseFloat(decodedData.total_amount.replace(/,/g, ''));
        
        db.query('UPDATE users SET balance = balance + ? WHERE id=?', [amount, userId], (err) => {
          if (err) console.error('Wallet recharge update failed:', err);
          else console.log(`Wallet recharged for User ${userId}: +${amount}`);
        });
      }

      res.json({ success: true, transaction: decodedData });
    } else {
      res.status(400).json({ success: false, error: "Signature mismatch or payment failed" });
    }
  } catch(e) {
    res.status(500).send(e.message);
  }
});



app.post('/api/ride-request/:id/accept', (req,res)=>{

	const token = req.headers['x-auth-token'] || req.body.token;
	const id = req.params.id;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err) { console.error('Accept check error:', err); return res.status(500).send(err); }
		if(!r.length) { console.log('Accept check: token not found'); return res.status(401).send('Unauthorized'); }
		const driver = r[0];
		if(!driver.role || driver.role.toLowerCase() !== 'driver') {
			console.error(`FORBIDDEN (Accept): User ${driver.id} role mismatch. Role: ${driver.role}`);
			return res.status(403).send('Forbidden: Driver role required');
		}
		if(driver.approval_status !== 'approved') {
			console.error(`FORBIDDEN (Accept): User ${driver.id} not approved. Status: ${driver.approval_status}`);
			return res.status(403).send(`Forbidden: Account ${driver.approval_status}`);
		}

		// use a DB connection and transaction to atomically accept
		db.getConnection((cErr, conn)=>{
			if(cErr) return res.status(500).send(cErr);
			conn.beginTransaction(txErr=>{
				if(txErr){ conn.release(); return res.status(500).send(txErr); }
				conn.query("SELECT COUNT(*) AS cnt FROM ride_requests WHERE accepted_by=? AND status NOT IN ('completed', 'cancelled', 'rejected')", [driver.id], (er, rows)=>{
					if(er){ return conn.rollback(()=>{ conn.release(); res.status(500).send(er); }); }
					if(rows && rows[0] && rows[0].cnt > 0){ return conn.rollback(()=>{ conn.release(); res.status(409).send('Driver has an active ride or request'); }); }

					conn.query('UPDATE ride_requests SET status=?, accepted_by=? WHERE id=? AND status=?',['accepted', driver.id, id, 'pending'], (uErr, uRes)=>{
						if(uErr){ return conn.rollback(()=>{ conn.release(); res.status(500).send(uErr); }); }
						if(!uRes || uRes.affectedRows === 0){ return conn.rollback(()=>{ conn.release(); res.status(409).send('Unable to accept (already accepted)'); }); }

						conn.query('UPDATE drivers SET status=? WHERE user_id=?',['ontrip', driver.id], (dErr)=>{
							if(dErr){ return conn.rollback(()=>{ conn.release(); res.status(500).send(dErr); }); }

							conn.commit(cmErr=>{
								if(cmErr){ return conn.rollback(()=>{ conn.release(); res.status(500).send(cmErr); }); }

								// notify patient socket
								const registry = io.registry || (io.registry = {});
								conn.query('SELECT user_id FROM ride_requests WHERE id=?',[id], (er2, rr)=>{
									if(er2) { conn.release(); return res.status(200).send({ok:true}); }
									const userId = rr[0].user_id;

									// Fetch patient details (name, phone)
									conn.query('SELECT name, phone FROM users WHERE id=?', [userId], (pErr, pRes)=>{
										const patientName = pRes && pRes[0] ? pRes[0].name : 'Patient';
										const patientPhone = pRes && pRes[0] ? pRes[0].phone : null;

										// Find patient socket(s)
										const patientSids = Object.keys(registry).filter(sid => registry[sid] && registry[sid].userId === userId);
										// Find driver socket(s)
										const driverSids = Object.keys(registry).filter(sid => registry[sid] && registry[sid].userId === driver.id);

										// Fetch destination coordinates from the request just accepted
										conn.query('SELECT destination_lat, destination_lng FROM ride_requests WHERE id=?', [id], (drErr, drRes) => {
											const destLat = drRes && drRes[0] ? drRes[0].destination_lat : null;
											const destLng = drRes && drRes[0] ? drRes[0].destination_lng : null;

											patientSids.forEach(sid => {
												io.to(sid).emit('ride_accepted', { 
													driverId: driver.id, 
													driverName: driver.name,
													driverPhone: driver.phone
												});
											});
											
											// Send SMS to patient about ride acceptance
											if (patientPhone) {
												sendSMS(patientPhone, `AmbuTrack: Your ambulance has been dispatched. Driver ${driver.name || ''} is on the way.`);
											}

											driverSids.forEach(sid => {
												io.to(sid).emit('ride_confirmed', { 
													id: id,
													patientSocketId: patientSids[0] || null,
													patientId: userId,
													patientName: patientName,
													patientPhone: patientPhone,
													destination_lat: destLat,
													destination_lng: destLng
												});
											});
											conn.release(); // release connection after final query
											res.send({ ok:true });
											// Trigger Notification for Patient
											triggerNotification(userId, 'TRIP_ACCEPTED', `Your ambulance request has been accepted by ${driver.name}.`);
										});
									});
								});
							});
						});
					});
				});
			});
		});
	});
});

app.post('/api/ride-request/:id/start-with-otp', (req, res) => {
	const token = req.headers['x-auth-token'];
	const id = req.params.id;
	const { otp } = req.body;
	
	if(!token) return res.status(401).send('Unauthorized');
	
	db.query('SELECT * FROM users WHERE token=?', [token], (err, r) => {
		if(err || !r.length) return res.status(401).send('Unauthorized');
		const driver = r[0];
		if(driver.role !== 'driver') return res.status(403).send('Forbidden');

		db.query('SELECT * FROM ride_requests WHERE id=? AND accepted_by=? AND status IN ("accepted", "arrived")', [id, driver.id], (er, rows) => {
			if(er) return res.status(500).send(er);
			if(!rows.length) return res.status(404).send('Active trip not found or incorrect state');
			
			const ride = rows[0];
			if(ride.otp && ride.otp !== otp) {
				return res.status(400).send('Invalid OTP');
			}
			
			db.query('UPDATE ride_requests SET status="started" WHERE id=?', [id], (uEr) => {
				if(uEr) return res.status(500).send(uEr);
				
				// Update Trip status if it exists
				db.query("UPDATE trips SET status='started', started_at=NOW() WHERE status!='completed' AND driver_id=(SELECT id FROM drivers WHERE user_id=?)", [driver.id]);

				// Notify patient
				const registry = io.registry || {};
				const patientSids = Object.keys(registry).filter(sid => registry[sid] && registry[sid].userId === ride.user_id);
				patientSids.forEach(sid => {
					io.to(sid).emit('ride_started', { id });
				});

				res.send({ ok: true });
			});
		});
	});
});

// Set trip destination (called by driver after starting trip)
app.post('/api/ride-request/:id/destination', (req, res) => {
	const token = req.headers['x-auth-token'];
	const id = req.params.id;
	const { lat, lng } = req.body;
	
	if(!token) return res.status(401).send('Unauthorized');
	if(!lat || !lng) return res.status(400).send('Missing coordinates');

	db.query('SELECT * FROM users WHERE token=?', [token], (err, r) => {
		if(err || !r.length) return res.status(401).send('Unauthorized');
		const driver = r[0];
		if(driver.role !== 'driver') return res.status(403).send('Forbidden');

		// Update destination in ride_requests with numeric casting
		const dLat = parseFloat(lat);
		const dLng = parseFloat(lng);
		
		db.query('UPDATE ride_requests SET destination_lat=?, destination_lng=? WHERE id=? AND accepted_by=?', [dLat, dLng, id, driver.id], (uEr, result) => {
			if(uEr) return res.status(500).send(uEr);
			if(result.affectedRows === 0) return res.status(404).send('Ride request not found or not assigned to you');

			// Update Trips table too
			db.query("UPDATE trips SET destination_lat=?, destination_lng=? WHERE status='started' AND driver_id=(SELECT id FROM drivers WHERE user_id=?)", [dLat, dLng, driver.id]);

			// Notify patient via socket
			db.query('SELECT user_id FROM ride_requests WHERE id=?', [id], (e2, rr) => {
				if(!e2 && rr.length){
					const userId = rr[0].user_id;
					const registry = io.registry || {};
					const patientSids = Object.keys(registry).filter(sid => registry[sid] && registry[sid].userId === userId);
					patientSids.forEach(sid => {
						io.to(sid).emit('ride_destination_updated', { id, lat, lng });
					});
				}
			});

			res.send({ ok: true });
		});
	});
});

// --- WALLET ENHANCEMENTS ---
app.get('/api/wallet/history', (req, res) => {
	const token = req.headers['x-auth-token'];
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?', [token], (err, users) => {
		if(err || !users.length) return res.status(401).send('Unauthorized');
		const user = users[0];
		db.query('SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [user.id], (e, rows) => {
			if(e) return res.status(500).send(e);
			res.json(rows);
		});
	});
});

app.post('/api/wallet/topup', (req, res) => {
	const token = req.headers['x-auth-token'];
	const { amount, method, description } = req.body;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?', [token], (err, users) => {
		if(err || !users.length) return res.status(401).send('Unauthorized');
		const user = users[0];
		const amt = parseFloat(amount);
		if(isNaN(amt) || amt <= 0) return res.status(400).send('Invalid amount');

		db.query('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id=?', [amt, user.id], (updErr) => {
			if(updErr) return res.status(500).send(updErr);
			db.query('INSERT INTO transactions(user_id, amount, type, description) VALUES(?,?,?,?)', 
				[user.id, amt, 'credit', description || `Top-up via ${method || 'eSewa'}`]);
			res.json({ ok:true, newBalance: parseFloat(user.wallet_balance) + amt });
		});
	});
});

app.post('/api/ride-request/:id/complete', (req, res) => {
	const token = req.headers['x-auth-token'] || req.body.token;
	const id = req.params.id;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err || !r.length) return res.status(401).send('Unauthorized');
		const driver = r[0];
		if(driver.role !== 'driver') return res.status(403).send('Forbidden');

		db.query("UPDATE ride_requests SET status='completed' WHERE id=? AND accepted_by=?", [id, driver.id], (uErr, result)=>{
			if(uErr) return res.status(500).send(uErr);
			if(result.affectedRows === 0) return res.status(404).send('Request not found or not assigned to you');

			// Free the driver
			db.query('UPDATE drivers SET status=? WHERE user_id=?', ['online', driver.id]);

			// Notify patient
			const registry = io.registry || (io.registry = {});
			db.query('SELECT user_id FROM ride_requests WHERE id=?', [id], (e2, rr)=>{
				if(!e2 && rr.length){
					const userId = rr[0].user_id;
					Object.keys(registry).forEach(sid => { 
						if(registry[sid] && registry[sid].userId === userId){ 
							io.to(sid).emit('trip_completed', { id }); 
						} 
					});
				}
				res.send({ ok:true });
			});
		});
	});
});

app.post('/api/ride-request/:id/pay', (req, res) => {
	const token = req.headers['x-auth-token'] || req.body.token;
	const id = req.params.id;
	const { method, amount } = req.body;
	if(!token) return res.status(401).send('Unauthorized');

	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err || !r.length) return res.status(401).send('Unauthorized');
		const user = r[0];
		if(user.role !== 'patient') return res.status(403).send('Forbidden');

		db.query('SELECT * FROM ride_requests WHERE id=? AND user_id=? AND status="completed"', [id, user.id], (e, rows)=>{
			if(e || !rows.length) return res.status(404).send('Completed ride request not found');
			
			const processPayment = () => {
				db.query("UPDATE ride_requests SET payment_method=?, payment_status='paid' WHERE id=?", [method, id], (ue)=>{
					if(ue) return res.status(500).send(ue);
					res.send({ ok:true, method });
				});
			};

			if(method === 'token'){
				if(user.wallet_balance < amount) return res.status(400).send('Insufficient wallet balance');
				db.query('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id=?', [amount, user.id], (ue2)=>{
					if(ue2) return res.status(500).send(ue2);
					processPayment();
				});
			} else {
				// COD or eSewa (mock)
				processPayment();
			}
		});
	});
});

app.get('/api/user/wallet', (req, res) => {
	const token = req.headers['x-auth-token'];
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT wallet_balance FROM users WHERE token=?', [token], (err, r)=>{
		if(err || !r.length) return res.status(401).send('Unauthorized');
		res.json({ balance: r[0].wallet_balance });
	});
});



// ── Nearby Hospitals / Clinics (Overpass API) ──────────────────
import axios from 'axios';
const hospitalCache = {};
const HOSPITAL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get('/api/nearby-hospitals', async (req, res) => {
	try {
		const lat = parseFloat(req.query.lat);
		const lng = parseFloat(req.query.lng);
		const radiusKm = parseFloat(req.query.radius) || 5;
		if (isNaN(lat) || isNaN(lng)) return res.status(400).send('Missing lat/lng');
		const radiusM = Math.round(radiusKm * 1000);

		// Cache key: rounded to ~500m grid
		const cacheKey = `${(lat * 2).toFixed(0)}_${(lng * 2).toFixed(0)}_${radiusKm}`;
		const cached = hospitalCache[cacheKey];
		if (cached && Date.now() - cached.ts < HOSPITAL_CACHE_TTL) {
			return res.json(cached.data);
		}

		// Overpass QL query for hospitals and clinics
		const overpassQuery = `[out:json][timeout:10];(node["amenity"="hospital"](around:${radiusM},${lat},${lng});node["amenity"="clinic"](around:${radiusM},${lat},${lng});way["amenity"="hospital"](around:${radiusM},${lat},${lng});way["amenity"="clinic"](around:${radiusM},${lat},${lng}););out center body;`;
		const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

		const response = await axios.get(overpassUrl, { timeout: 12000 });
		const elements = response.data?.elements || [];

		const results = elements.map(el => ({
			name: el.tags?.name || el.tags?.['name:en'] || 'Unnamed Facility',
			lat: el.lat || el.center?.lat,
			lng: el.lon || el.center?.lon,
			type: el.tags?.amenity || 'hospital',
			phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
			address: el.tags?.['addr:full'] || el.tags?.['addr:street'] || null
		})).filter(h => h.lat && h.lng);

		// Cache results
		hospitalCache[cacheKey] = { ts: Date.now(), data: results };

		res.json(results);
	} catch (e) {
		console.error('Nearby hospitals error:', e.message);
		// Return empty array on error so UI doesn't break
		res.json([]);
	}
});

// ── All Nepal Hospitals (Admin use) ─────────────────────────────
const nepalHospitalCache = { ts: 0, data: [] };
const NEPAL_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

app.get('/api/nepal-hospitals', async (req, res) => {
	try {
		if (nepalHospitalCache.data.length && Date.now() - nepalHospitalCache.ts < NEPAL_CACHE_TTL) {
			return res.json(nepalHospitalCache.data);
		}

		const query = `
			[out:json][timeout:60];
			area["ISO3166-1"="NP"]->.nepal;
			(
				node["amenity"~"hospital|clinic"](area.nepal);
				way["amenity"~"hospital|clinic"](area.nepal);
			);
			out center 500;
		`;
		const response = await axios.post('https://overpass-api.de/api/interpreter',
			`data=${encodeURIComponent(query)}`,
			{ headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 65000 }
		);
		const elements = response.data?.elements || [];
		const results = elements.map(el => ({
			name: el.tags?.name || el.tags?.['name:en'] || 'Unnamed Facility',
			lat: el.lat || el.center?.lat,
			lng: el.lon || el.center?.lon,
			type: el.tags?.amenity || 'hospital',
			phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
			address: el.tags?.['addr:full'] || el.tags?.['addr:street'] || el.tags?.['addr:city'] || null,
			district: el.tags?.['addr:district'] || el.tags?.['is_in:district'] || null,
			province: el.tags?.['addr:province'] || null,
			website: el.tags?.website || null,
			opening_hours: el.tags?.opening_hours || null,
		})).filter(h => h.lat && h.lng);

		nepalHospitalCache.ts = Date.now();
		nepalHospitalCache.data = results;
		res.json(results);
	} catch (e) {
		console.error('Nepal hospitals error:', e.message);
		res.json([]);
	}
});


/* Ambulance list */

app.get("/ambulances",(req,res)=>{

db.query(
"SELECT * FROM ambulances",
(err,result)=>{

res.send(result)

})

})


/* Add ambulance */

app.post("/ambulance",(req,res)=>{

const {driver,lat,lng,status}=req.body;

db.query(
"INSERT INTO ambulances(driver,lat,lng,status) VALUES(?,?,?,?)",
[driver,lat,lng,status],
(err,result)=>{

if(err) return res.send(err);

io.emit("receiveLocation",req.body)

res.send("Added")

})

})


/* Socket */
const disconnectTimers = new Map(); // For location stability grace period

io.on("connection",(socket)=>{
	console.log("User Connected")

	// simple in-memory registry: socketId -> { name, role, userId }
	const registry = io.registry || (io.registry = {});

	// try to authenticate immediately from handshake auth token
	const token = socket.handshake?.auth?.token;
	if(token){
		db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
			if(!err && r && r.length){
				const u = r[0]; registry[socket.id] = { name: u.name, role: u.role, userId: u.id };
				socket.emit('identified', { ok:true, role: u.role });
				console.log('Socket identified via token', socket.id, u.email);
				return;
			}
			// fallback: register as guest
			registry[socket.id] = { name: 'guest', role: 'guest' };
		});
	}else{
		registry[socket.id] = { name: 'guest', role: 'guest' };
	}

	// also allow explicit identify event for backward compatibility
	socket.on('identify', info => {
		try{
			if(info && info.token){
				db.query('SELECT * FROM users WHERE token=?',[info.token], (err, r)=>{
					if(!err && r && r.length){ 
						const u = r[0]; 
						registry[socket.id] = { name: u.name, role: u.role, userId: u.id }; 
						socket.emit('identified', { ok:true, role: u.role }); 
						
						// Clear any pending disconnect timer for this user
						if (disconnectTimers.has(u.id)) {
							clearTimeout(disconnectTimers.get(u.id));
							disconnectTimers.delete(u.id);
							console.log(`Grace period cleared for ${u.name}`);
						}
					}
				});
			}else{
				registry[socket.id] = { name: info?.name || 'unknown', role: info?.role || 'guest' };
			}
		}catch(e){}
	});

// handle driver online/offline via socket (token or driverId)
socket.on('driver_online', payload => {
	try{
		const token = payload?.token;
		if(token){
			db.query('SELECT * FROM users WHERE token=?',[token], (err, rows)=>{
				if(err || !rows.length) return;
				const u = rows[0];
				db.query('SELECT id FROM drivers WHERE user_id=?',[u.id], (e, drows)=>{
					if(drows && drows.length){
						db.query('UPDATE drivers SET status=? WHERE user_id=?',['online', u.id]);
					}else{
						db.query('INSERT INTO drivers(user_id, name, status) VALUES(?,?,?)',[u.id, u.name, 'online']);
					}
				});
			});
		}else if(payload?.driverId){
			db.query('UPDATE drivers SET status=? WHERE id=?',['online', payload.driverId]);
		}
	}catch(e){}
});

socket.on('driver_offline', payload => {
	try{
		const token = payload?.token;
		if(token){
			db.query('SELECT * FROM users WHERE token=?',[token], (err, rows)=>{
				if(err || !rows.length) return;
				const u = rows[0];
				db.query('UPDATE drivers SET status=? WHERE user_id=?',['offline', u.id]);
			});
		}else if(payload?.driverId){
			db.query('UPDATE drivers SET status=? WHERE id=?',['offline', payload.driverId]);
		}
	}catch(e){}
});

socket.on('disconnect', () => {
	try {
		const info = registry[socket.id];
		if (info && info.role === 'driver' && info.userId) {
			console.log(`Driver disconnected (grace period started): ${info.userId}`);
			
			// Start a 10s grace period before marking offline
			const timerId = setTimeout(() => {
				db.query('UPDATE drivers SET status=? WHERE user_id=?', ['offline', info.userId], (err) => {
					if(!err) io.emit('driver_offline', { driverId: info.userId, userId: info.userId });
				});
				disconnectTimers.delete(info.userId);
				console.log(`Driver ${info.userId} marked offline after grace period.`);
			}, 10000);
			
			disconnectTimers.set(info.userId, timerId);
		}
		delete registry[socket.id];
	} catch(e) {}
});

socket.on("sendLocation",(data)=>{
	// broadcast live location updates for map view
	io.emit("receiveLocation",data)
	// persist driver location when possible
	try{
		const uid = registry[socket.id] && registry[socket.id].userId ? registry[socket.id].userId : null;
		const driverId = data && data.driverId ? data.driverId : null;
		if(driverId){
			db.query('UPDATE drivers SET lat=?, lng=? WHERE id=?',[data.lat, data.lng, driverId]);
		}else if(uid){
			// try update by user_id mapping
			db.query('UPDATE drivers SET lat=?, lng=? WHERE user_id=?',[data.lat, data.lng, uid]);
		}
	}catch(e){}
});

// Patient emits a ride_request with { name, lat, lng, details }
socket.on('ride_request', req => {
	// For backward compatibility: allow socket-based request (will not persist without token)
	const token = req?.token;
	if(token){
		// create DB entry via internal flow
		db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
			if(err || !r.length) return;
			const user = r[0];
			// only patients may create ride requests
			if(user.role !== 'patient') return;
			db.query('INSERT INTO ride_requests(user_id,lat,lng) VALUES(?,?,?)',[user.id, req.lat, req.lng], (e, resu)=>{
				if(e) return; const id = resu.insertId;
				Object.keys(registry).forEach(sid=>{ if(registry[sid] && registry[sid].role==='driver'){ io.to(sid).emit('ride_request', { id, userId:user.id, lat:req.lat, lng:req.lng }) } });
			});
		});
		return;
	}
	// forward request in-memory to drivers
	Object.keys(registry).forEach(sid=>{ if(registry[sid] && registry[sid].role === 'driver'){ io.to(sid).emit('ride_request', { ...req, requesterSocketId: socket.id }); } });
});

// Driver accepts: { requesterSocketId, driverName }
socket.on('ride_accept', data => {
	// support accept by ride id
	const rideId = data?.rideId;
	if(rideId){
		// mark in DB and notify patient socket if available
		const reg = io.registry || (io.registry = {});
		const driverEntry = registry[socket.id];
		// only drivers may accept
		if(driverEntry?.role !== 'driver') return;
		const driverId = driverEntry.userId || null;
		db.query('UPDATE ride_requests SET status=?, accepted_by=? WHERE id=?',['accepted', driverId, rideId], (e)=>{
			if(e) return;
			// find patient user id and notify
			db.query('SELECT user_id FROM ride_requests WHERE id=?',[rideId], (er, rr)=>{
				if(er || !rr.length) return;
				const userId = rr[0].user_id;
				Object.keys(registry).forEach(sid=>{ if(registry[sid] && registry[sid].userId===userId){ io.to(sid).emit('ride_accepted', { driverId, driverName: driverEntry?.name }) } });
			});
		});
		return;
	}
	const patientSock = data?.requesterSocketId;
	if(patientSock){
		const driverEntry2 = registry[socket.id];
		// only drivers may accept via socket
		if(driverEntry2?.role !== 'driver') return;
		io.to(patientSock).emit('ride_accepted', { driverName: data.driverName, driverSocketId: socket.id });
		socket.emit('ride_confirmed', { patientSocketId: patientSock });
	}
});

// Driver accepts a trip offer via socket: { tripId }
socket.on('trip_accept', data => {
	const tripId = data?.tripId;
	const registry = io.registry || (io.registry = {});
	const driverEntry = registry[socket.id];
	if(!driverEntry || driverEntry.role !== 'driver') return;
	const driverId = driverEntry.userId;
	if(!tripId) return;
	// atomically accept only if still requesting
	db.query("UPDATE trips SET status='accepted' WHERE id=? AND driver_id=? AND status='requesting'", [tripId, driverId], (err, result)=>{
		if(err) return;
		if(!result || result.affectedRows === 0) return;
		// mark driver on trip
		db.query('UPDATE drivers SET status=? WHERE id=?', ['ontrip', driverId]);
		// notify patient socket
		db.query('SELECT patient_id FROM trips WHERE id=?',[tripId], (e, rows)=>{
			if(e || !rows.length) return;
			const patientId = rows[0].patient_id;
			try{
				Object.keys(registry).forEach(sid=>{ if(registry[sid] && registry[sid].userId===patientId){ io.to(sid).emit('ride_accepted', { tripId, driverId, driverName: driverEntry.name }); } });
			}catch(e){}
	});
	});
});

// Paired users can emit 'pair_location' to send location to the paired socket
socket.on('pair_location', payload => {
	// payload: { toSocketId, lat, lng }
	if(payload && payload.toSocketId){
		io.to(payload.toSocketId).emit('pair_location', { from: socket.id, lat: payload.lat, lng: payload.lng });
	}
});

// Redundant disconnect listener removed

})

// ── Nearby Hospitals (Overpass API / OpenStreetMap) ────────────────────────
app.get('/api/nearby-hospitals', async (req, res) => {
	try {
		const { lat, lng, radius = 5 } = req.query;
		if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });
		const radiusMeters = Math.min(parseFloat(radius) * 1000, 100000); // cap at 100km
		const overpassQuery = `[out:json][timeout:25];
(
  node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
  node["amenity"="clinic"](around:${radiusMeters},${lat},${lng});
  way["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
  way["amenity"="clinic"](around:${radiusMeters},${lat},${lng});
);
out center;`;
		const { default: axios } = await import('axios');
		const response = await axios.post(
			'https://overpass-api.de/api/interpreter',
			overpassQuery,
			{ headers: { 'Content-Type': 'text/plain' }, timeout: 20000 }
		);
		const elements = response.data?.elements || [];
		const hospitals = elements.map(el => {
			const tags = el.tags || {};
			const elLat = el.lat ?? el.center?.lat;
			const elLng = el.lon ?? el.center?.lon;
			if (!elLat || !elLng) return null;
			return {
				name: tags.name || tags['name:en'] || (tags.amenity === 'hospital' ? 'Hospital' : 'Clinic'),
				lat: elLat,
				lng: elLng,
				type: tags.amenity || 'hospital',
				phone: tags.phone || tags['contact:phone'] || null,
				website: tags.website || null,
			};
		}).filter(Boolean);
		res.json(hospitals);
	} catch (err) {
		console.error('Nearby hospitals error:', err.message);
		// Return empty array on failure so frontend degrades gracefully
		res.json([]);
	}
});

// ── Wallet Balance ──────────────────────────────────────────────────────────
app.get('/api/user/wallet', (req, res) => {
	const token = req.headers['x-auth-token'];
	if (!token) return res.status(401).json({ error: 'Unauthorized' });
	db.query('SELECT wallet_balance FROM users WHERE token=?', [token], (err, rows) => {
		if (err) return res.status(500).json({ error: err.message });
		if (!rows.length) return res.status(401).json({ error: 'Unauthorized' });
		res.json({ balance: parseFloat(rows[0].wallet_balance || 0) });
	});
});

// ── Payment for a Ride Request ─────────────────────────────────────────────
app.post('/api/ride-request/:id/pay', (req, res) => {
	const token = req.headers['x-auth-token'];
	const rideId = req.params.id;
	const { method, amount } = req.body;
	if (!token) return res.status(401).json({ error: 'Unauthorized' });

	db.query('SELECT * FROM users WHERE token=?', [token], (err, rows) => {
		if (err) return res.status(500).json({ error: err.message });
		if (!rows.length) return res.status(401).json({ error: 'Unauthorized' });
		const user = rows[0];

		const processPayment = () => {
			db.query(
				"UPDATE ride_requests SET payment_status='paid', payment_method=? WHERE id=? AND user_id=?",
				[method || 'cod', rideId, user.id],
				(e2, r2) => {
					if (e2) return res.status(500).json({ error: e2.message });
					if (!r2 || r2.affectedRows === 0) return res.status(404).json({ error: 'Ride not found or unauthorized' });
					res.json({ ok: true, method, amount });
				}
			);
		};

		// If paying with wallet/token, deduct balance first
		if (method === 'token' || method === 'wallet') {
			const fare = parseFloat(amount || 0);
			const balance = parseFloat(user.wallet_balance || 0);
			if (balance < fare) return res.status(400).json({ error: 'Insufficient wallet balance' });
			db.query('UPDATE users SET wallet_balance=wallet_balance-? WHERE id=?', [fare, user.id], (e3) => {
				if (e3) return res.status(500).json({ error: e3.message });
				processPayment();
			});
		} else {
			processPayment();
		}
	});
});

// ── Patient Trip History ────────────────────────────────────────────────────
app.get('/api/patient/trip-history', (req, res) => {
	const token = req.headers['x-auth-token'];
	if (!token) return res.status(401).json({ error: 'Unauthorized' });
	db.query('SELECT * FROM users WHERE token=?', [token], (err, rows) => {
		if (err) return res.status(500).json({ error: err.message });
		if (!rows.length) return res.status(401).json({ error: 'Unauthorized' });
		const user = rows[0];
		db.query(
			`SELECT rr.id, rr.status, rr.payment_method, rr.payment_status, rr.lat, rr.lng,
			        rr.created_at, rr.accepted_by,
			        u2.name AS driver_name,
			        u2.vehicle_name, u2.base_fare, u2.per_km_rate
			 FROM ride_requests rr
			 LEFT JOIN users u2 ON u2.id = rr.accepted_by
			 WHERE rr.user_id = ? AND rr.status IN ('completed','paid')
			 ORDER BY rr.created_at DESC LIMIT 30`,
			[user.id],
			(e2, trips) => {
				if (e2) return res.status(500).json({ error: e2.message });
				res.json(trips || []);
			}
		);
	});
});

// ── Support Contact Form ────────────────────────────────────────────────────
// Initialize Notifications Table
db.query(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`, (err) => {
  if (err) console.error("Error creating notifications table:", err);
  else console.log("Notifications table ready");
});

// Helper to trigger a notification
const triggerNotification = (userId, type, message) => {
  db.query('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', [userId, type, message], (err, res) => {
    if (err) console.error("Trigger notification error:", err);
    else {
      // Emit via socket if user is online
      const registry = io.registry || {};
      const sids = Object.keys(registry).filter(sid => registry[sid].userId === userId);
      sids.forEach(sid => {
        io.to(sid).emit('new_notification', { id: res.insertId, type, message, created_at: new Date() });
      });
    }
  });
};

// GET all notifications for a user
app.get('/api/notifications', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).send('Unauthorized');
  db.query('SELECT id FROM users WHERE token=?', [token], (err, r) => {
    if (err || !r.length) return res.status(401).send('Unauthorized');
    const userId = r[0].id;
    db.query('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [userId], (e, rows) => {
      if (e) return res.status(500).send(e);
      res.send(rows);
    });
  });
});

// MARK notification as read
app.put('/api/notifications/:id/read', (req, res) => {
  const token = req.headers['x-auth-token'];
  const { id } = req.params;
  if (!token) return res.status(401).send('Unauthorized');
  db.query('SELECT id FROM users WHERE token=?', [token], (err, r) => {
    if (err || !r.length) return res.status(401).send('Unauthorized');
    db.query('UPDATE notifications SET is_read=TRUE WHERE id=? AND user_id=?', [id, r[0].id], (e) => {
      if (e) return res.status(500).send(e);
      res.send({ ok: true });
    });
  });
});

// ── Support Contact Form ────────────────────────────────────────────────────
app.post('/api/support/contact', async (req, res) => {
	try {
		const { name, email, subject, message } = req.body;
		if (!name || !email || !message) return res.status(400).json({ error: 'Missing required fields' });

		const html = `
			<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e2e8f0">
				<h2 style="color:#c62828;margin:0 0 16px">AmbuTrack — Support Message</h2>
				<table style="width:100%;border-collapse:collapse">
					<tr><td style="padding:8px 0;color:#64748b;font-weight:600;width:100px">From:</td><td style="padding:8px 0">${name} &lt;${email}&gt;</td></tr>
					<tr><td style="padding:8px 0;color:#64748b;font-weight:600">Subject:</td><td style="padding:8px 0">${subject || '(no subject)'}</td></tr>
				</table>
				<div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:8px;color:#1e293b;line-height:1.6">${message.replace(/\n/g, '<br>')}</div>
				<p style="margin-top:16px;color:#94a3b8;font-size:0.8rem">Sent via AmbuTrack Support Form</p>
			</div>`;

		if (mailTransporter) {
			const toAddr = process.env.SMTP_FROM || process.env.SMTP_USER;
			await new Promise((resolve, reject) => {
				mailTransporter.sendMail(
					{ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: toAddr, replyTo: email, subject: `Support: ${subject || 'New Message'} — from ${name}`, html },
					(err) => err ? reject(err) : resolve()
				);
			});
			return res.json({ ok: true, method: 'email' });
		}
		// No SMTP — still acknowledge receipt
		console.log('Support contact (no SMTP):', { name, email, subject, message });
		res.json({ ok: true, method: 'logged' });
	} catch (e) {
		console.error('Support contact error:', e);
		res.status(500).json({ error: 'Failed to send message. Please try again.' });
	}
});

// ── eSewa Signature Generation ─────────────────────────────────────────────

app.post('/api/payment/esewa/signature', (req, res) => {
	const { amount, transaction_uuid } = req.body;
	if (!amount || !transaction_uuid) return res.status(400).json({ error: 'Missing amount or uid' });

	// eSewa test credentials
	const product_code = 'EPAYTEST';
	const secretKey = '8gBm/:&EnhH.1/q';

	const message = `total_amount=${amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;
	const hash = crypto.createHmac('sha256', secretKey).update(message).digest('base64');

	res.json({
		signature: hash,
		signed_field_names: 'total_amount,transaction_uuid,product_code',
		product_code
	});
});

// Catch-all route for SPA support
app.get("*", (req, res) => {
    // Only serve index.html for non-API routes
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.join(__dirname, "..", "frontend", "dist", "index.html"));
    } else {
        res.status(404).send('Not Found');
    }
});

const PORT = parseInt(process.env.PORT, 10) || 5000;

const startServer = (port) => {
  // Completely clear any previous listeners
  server.removeAllListeners('error');
  
  if (server.listening) {
    server.close(() => startServer(port));
    return;
  }

  const s = server.listen(port, () => {
    console.log(`Server Running at http://localhost:${port}`);
    // Run DB initialization only after successful port bind
    initDB(); 
  });

  s.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use.`);
      // Optional: auto-retry once or just stop to let user fix terminals
      // For now, we'll try one fallback or just exit to be safe
      /*
      s.close(() => {
        setTimeout(() => startServer(port + 1), 200);
      });
      */
    } else {
      console.error('Startup Error:', err);
    }
  });
};


startServer(PORT);