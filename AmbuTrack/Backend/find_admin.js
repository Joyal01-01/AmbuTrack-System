import mysql from 'mysql2';
import dotenv from 'dotenv';
dotenv.config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.query("SELECT email FROM users WHERE role='admin' LIMIT 1", (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('Admin Email:', rows[0]?.email || 'None');
  }
  db.end();
});
