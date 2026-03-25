import mysql from 'mysql2';
import fs from 'fs';

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'joyal',
  database: 'ambutrack'
});

db.query("SELECT id, email, role, name FROM users", (err, rows) => {
  if (err) {
    fs.writeFileSync('users_dump.txt', 'Error: ' + err.message);
  } else {
    fs.writeFileSync('users_dump.txt', JSON.stringify(rows, null, 2));
  }
  process.exit();
});
