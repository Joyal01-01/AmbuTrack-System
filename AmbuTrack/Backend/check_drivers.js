import mysql from 'mysql2';
import dotenv from 'dotenv';
dotenv.config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.query("SELECT id, name, email, role, approval_status FROM users WHERE role='driver'", (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('--- Current Drivers Status ---');
    rows.forEach(r => {
        console.log(`ID: ${r.id}, Name: ${r.name}, Email: ${r.email}, Status: ${r.approval_status}`);
    });
  }
  db.end();
});
