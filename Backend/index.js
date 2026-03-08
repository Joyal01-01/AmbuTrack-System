import express from "express";
import mysql from "mysql2";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server,{
cors:{
origin:"*"
}
});

/* MySQL Connection */

const db = mysql.createConnection({

host:process.env.DB_HOST,
user:process.env.DB_USER,
password:process.env.DB_PASSWORD,
database:process.env.DB_NAME

});

db.connect((err)=>{

if(err){
console.log(err)
}else{
console.log("MySQL Connected")
}

});

// create mail transporter only when SMTP env vars provided
let mailTransporter = null;
if(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS){
	try{
		mailTransporter = nodemailer.createTransport({
			host: process.env.SMTP_HOST,
			port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
			secure: process.env.SMTP_SECURE === 'true',
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASS
			}
		});
		console.log('Mail transporter configured');
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
	code VARCHAR(64),
	expires_at DATETIME,
	used BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

db.query(createUsersTable, (e)=>{ if(e) console.log('users table error', e); else { db.query(createAmbulancesTable, (e2)=>{ if(e2) console.log('ambulances table error', e2); else { db.query(createRideRequestsTable, (e3)=>{ if(e3) console.log('ride_requests table error', e3); else { db.query(createOtpsTable, (e4)=>{ if(e4) console.log('otps table error', e4); else console.log('DB tables ready'); }); } }); } }); } });

// attempt to alter existing users table to include missing columns (safe with IF NOT EXISTS)
db.query("ALTER TABLE users ADD COLUMN password VARCHAR(255)", (err)=>{ if(err && !/Duplicate column/i.test(err.message) ) console.log('alter password error', err); });
db.query("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'patient'", (err)=>{ if(err && !/Duplicate column/i.test(err.message) ) console.log('alter role error', err); });
db.query("ALTER TABLE users ADD COLUMN token VARCHAR(255)", (err)=>{ if(err && !/Duplicate column/i.test(err.message) ) console.log('alter token error', err); });
// add two-factor flag if missing
db.query("ALTER TABLE users ADD COLUMN twofa_enabled TINYINT(1) DEFAULT 0", (err)=>{ if(err && !/Duplicate column/i.test(err.message) ) console.log('alter twofa_enabled error', err); });

// Ensure timestamp columns have defaults so inserts work
db.query("ALTER TABLE users MODIFY createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP", (err)=>{ if(err) console.log('modify createdAt err', err); });
db.query("ALTER TABLE users MODIFY updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", (err)=>{ if(err) console.log('modify updatedAt err', err); });

// remove duplicate email indexes if they exist (keep only one unique index on email)
db.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email'", [process.env.DB_NAME], (err, rows)=>{
	if(err) return;
	try{
		const idxs = rows.map(r=>r.INDEX_NAME).filter(n=>n && n !== 'PRIMARY');
		if(idxs.length > 1){
			// keep first, drop the rest
			const keep = idxs[0];
			const toDrop = idxs.slice(1);
			toDrop.forEach(name=>{
				try{ db.query(`ALTER TABLE users DROP INDEX \`${name}\``, ()=>{}); }catch(e){}
			});
			console.log('Dropped duplicate email indexes:', toDrop);
		}
	}catch(e){}
});

// Attempt to drop legacy passwordHash column (if present) after migrating support
// MySQL older versions don't support DROP COLUMN IF EXISTS — check first
db.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND COLUMN_NAME='passwordHash'", [process.env.DB_NAME], (err, cols)=>{
	if(err) return;
	if(cols && cols.length){
		db.query('ALTER TABLE users DROP COLUMN passwordHash', (e)=>{ if(e) console.log('drop passwordHash err', e); else console.log('Dropped legacy passwordHash column'); });
	}
});


/* Register */
// Send OTP for registration (dev: returns OTP in response for testing)
app.post('/send-otp', (req, res) => {
	try{
		const { email } = req.body;
		if(!email) return res.status(400).send('Missing email');
		const code = String(Math.floor(100000 + Math.random() * 900000));
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
		db.query('INSERT INTO otps(email,code,expires_at) VALUES(?,?,?)',[email, code, expiresAt], (err)=>{
			if(err) return res.status(500).send(err);
			// If mail transporter is configured, attempt to email the OTP
			if(mailTransporter){
				const msg = `Your AmbuTrack OTP is ${code}. It expires in 5 minutes.`;
				mailTransporter.sendMail({
					from: process.env.SMTP_FROM || process.env.SMTP_USER,
					to: email,
					subject: 'AmbuTrack OTP',
					text: msg,
					html: `<p>${msg}</p>`
				}, (mailErr, info) => {
					if(mailErr){
						console.log('OTP email error', mailErr);
						// fallback: return OTP in response in dev
						return res.send({ ok:true, otp: code, expiresAt, emailed:false });
					}
					return res.send({ ok:true, expiresAt, emailed:true });
				});
			}else{
				// In production, send via SMS/email. For now return OTP for testing.
				res.send({ ok:true, otp: code, expiresAt });
			}
		});
	}catch(e){ res.status(500).send('Error') }
});

// Register using OTP
app.post("/register",async (req,res)=>{
	try{
		const {name,email,password,role,otp} = req.body;
		if(!email || !password || !otp) return res.status(400).send('Missing');
		// verify OTP
		db.query('SELECT * FROM otps WHERE email=? AND code=? AND used=0 AND expires_at>NOW() ORDER BY id DESC LIMIT 1',[email, otp], async (err, rows)=>{
			if(err) return res.status(500).send(err);
			if(!rows || !rows.length) return res.status(400).send('Invalid or expired OTP');
			const otpEntry = rows[0];
			const hash = await bcrypt.hash(password, 10);
			db.query("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",[name,email,hash,role||'patient'],(e,result)=>{
				if(e) return res.status(500).send(e);
				// mark otp used
				db.query('UPDATE otps SET used=1 WHERE id=?',[otpEntry.id]);
				res.send({ message: 'Registered' });
			});
		});
	}catch(e){ res.status(500).send('Error') }
});


/* Login */

app.post('/login', (req,res)=>{
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
		const safe = { id: user.id, name: user.name, email: user.email, role: user.role, token };
		res.send(safe);
	});
});

// Verify OTP for login and issue token
app.post('/login-verify', (req, res) => {
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
			const safe = { id: user.id, name: user.name, email: user.email, role: user.role, token };
			res.send(safe);
		});
	});
});

// Toggle two-factor for authenticated user
app.post('/user/2fa', (req, res) => {
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

// create ride request via REST (authenticated by token)
app.post('/ride-request', (req,res)=>{
	const token = req.headers['x-auth-token'] || req.body.token;
	const { lat, lng } = req.body;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		const user = r[0];
		// only patients may create ride requests
		if(user.role !== 'patient') return res.status(403).send('Forbidden');
		db.query('INSERT INTO ride_requests(user_id,lat,lng) VALUES(?,?,?)',[user.id, lat, lng], (e, resu)=>{
			if(e) return res.status(500).send(e);
			const id = resu.insertId;
			// broadcast to drivers via sockets
			const registry = io.registry || (io.registry = {});
			Object.keys(registry).forEach(sid=>{ if(registry[sid] && registry[sid].role==='driver'){ io.to(sid).emit('ride_request', { id, userId:user.id, lat, lng }) } });
			res.send({ id });
		});
	});
});

app.get('/ride-requests', (req,res)=>{
	db.query('SELECT * FROM ride_requests WHERE status="pending"', (err, r)=>{ if(err) return res.status(500).send(err); res.send(r) });
});

// Admin: list all ride requests (requires admin token)
app.get('/admin/ride-requests', (req, res) => {
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
app.get('/admin/ambulances', (req, res) => {
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

// Mail testing endpoint - creates an Ethereal test account and sends a sample email
app.post('/mail-test', async (req, res) => {
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

app.post('/ride-request/:id/accept', (req,res)=>{
	const token = req.headers['x-auth-token'] || req.body.token;
	const id = req.params.id;
	if(!token) return res.status(401).send('Unauthorized');
	db.query('SELECT * FROM users WHERE token=?',[token], (err, r)=>{
		if(err) return res.status(500).send(err);
		if(!r.length) return res.status(401).send('Unauthorized');
		const driver = r[0];
		// only drivers may accept ride requests
		if(driver.role !== 'driver') return res.status(403).send('Forbidden');
		db.query('UPDATE ride_requests SET status=?, accepted_by=? WHERE id=?',['accepted', driver.id, id], (e)=>{
			if(e) return res.status(500).send(e);
			// notify patient socket if connected
			const registry = io.registry || (io.registry = {});
			// find patient socket by user_id
			db.query('SELECT user_id FROM ride_requests WHERE id=?',[id], (er, rr)=>{
				if(er) return res.status(200).send({ok:true});
				const userId = rr[0].user_id;
				Object.keys(registry).forEach(sid=>{ if(registry[sid] && registry[sid].userId===userId){ io.to(sid).emit('ride_accepted', { driverId: driver.id, driverName: driver.name }) } });
				res.send({ ok:true });
			});
		});
	});
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

io.on("connection",(socket)=>{
	console.log("User Connected", socket.id)

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
					if(!err && r && r.length){ const u = r[0]; registry[socket.id] = { name: u.name, role: u.role, userId: u.id }; socket.emit('identified', { ok:true, role: u.role }); }
				});
			}else{
				registry[socket.id] = { name: info?.name || 'unknown', role: info?.role || 'guest' };
			}
		}catch(e){}
	});

socket.on("sendLocation",(data)=>{
	// broadcast live location updates for map view
	io.emit("receiveLocation",data)
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

// Paired users can emit 'pair_location' to send location to the paired socket
socket.on('pair_location', payload => {
	// payload: { toSocketId, lat, lng }
	if(payload && payload.toSocketId){
		io.to(payload.toSocketId).emit('pair_location', { from: socket.id, lat: payload.lat, lng: payload.lng });
	}
});

socket.on('disconnect', ()=>{
	delete registry[socket.id];
});

})


const PORT = process.env.PORT || 5001;
server.listen(PORT,()=>{
	console.log(`Server Running Port ${PORT}`)
})