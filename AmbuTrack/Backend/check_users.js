import mysql from 'mysql2';

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'joyal',
  database: 'ambutrack'
});

db.query("SELECT id, email, role, name FROM users", (err, rows) => {
  if (err) {
    console.error('Check users error:', err);
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }
  process.exit();
});
