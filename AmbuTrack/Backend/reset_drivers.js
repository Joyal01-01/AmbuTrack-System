import mysql from 'mysql2';
import dotenv from 'dotenv';
dotenv.config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.query("UPDATE users SET approval_status='pending' WHERE role='driver'", (err, result) => {
  if (err) {
    console.error(err);
  } else {
    console.log('Reset drivers status to pending:', result.affectedRows);
  }
  db.end();
});
