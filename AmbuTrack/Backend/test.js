import db from './config/db.js';
import fs from 'fs';

db.query("DESCRIBE trips", (e, r) => {
  if (!e) fs.writeFileSync('schema_dump.txt', 'trips:\n' + r.map(c => c.Field).join(', ') + '\n');
  db.query("DESCRIBE ride_requests", (e2, r2) => {
    if (!e2) fs.appendFileSync('schema_dump.txt', 'ride_requests:\n' + r2.map(c => c.Field).join(', ') + '\n');
    process.exit(0);
  });
});
