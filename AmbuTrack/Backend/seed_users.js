import mysql from 'mysql2';
import bcrypt from 'bcryptjs';

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'joyal',
  database: 'ambutrack'
});

const pw = bcrypt.hashSync('password', 10);

const queries = [
  "INSERT INTO users (name, email, password, role, approval_status) VALUES ('Test Patient', 'patient@test.com', '"+pw+"', 'patient', 'approved') ON DUPLICATE KEY UPDATE password='"+pw+"'",
  "INSERT INTO users (name, email, password, role, approval_status) VALUES ('Test Driver', 'driver@test.com', '"+pw+"', 'driver', 'approved') ON DUPLICATE KEY UPDATE password='"+pw+"'",
  "INSERT INTO users (name, email, password, role, approval_status) VALUES ('Test Admin', 'admin@test.com', '"+pw+"', 'admin', 'approved') ON DUPLICATE KEY UPDATE password='"+pw+"'"
];

let completed = 0;
queries.forEach(q => {
  db.query(q, (err) => {
    if (err) console.error(err);
    completed++;
    if (completed === queries.length) {
      console.log('Users created successfully');
      process.exit(0);
    }
  });
});
