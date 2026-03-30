import db from './config/db.js';

const sql1 = "ALTER TABLE ride_requests ADD COLUMN destination_lat DECIMAL(10,8) NULL AFTER otp";
const sql2 = "ALTER TABLE ride_requests ADD COLUMN destination_lng DECIMAL(11,8) NULL AFTER destination_lat";

console.log("Running migration...");

db.query(sql1, (err) => {
  if (err && err.code !== 'ER_DUP_COLUMN_NAMES') {
    console.error("Error adding destination_lat:", err.message);
  } else {
    console.log("Column destination_lat added or already exists.");
  }

  db.query(sql2, (err2) => {
    if (err2 && err2.code !== 'ER_DUP_COLUMN_NAMES') {
      console.error("Error adding destination_lng:", err2.message);
    } else {
      console.log("Column destination_lng added or already exists.");
    }
    
    console.log("Migration complete.");
    process.exit(0);
  });
});
