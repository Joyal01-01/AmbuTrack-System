import mysql from 'mysql2';

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'joyal',
  database: 'ambutrack'
});

db.query("UPDATE users SET wallet_balance = 5000.00 WHERE email = 'patient@test.com'", (err, result) => {
  if (err) {
    console.error('Seed wallet error:', err);
  } else {
    console.log('Wallet seeded for patient@test.com:', result.affectedRows);
  }
  process.exit();
});
