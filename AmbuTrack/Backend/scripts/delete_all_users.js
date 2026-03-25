import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function run(){
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ambutrack'
  });

  try{
    const [usersRows] = await conn.query('SELECT id, email FROM users');
    if(!usersRows || usersRows.length === 0){
      console.log('No users found. Nothing to delete.');
      await conn.end();
      return;
    }

    const ids = usersRows.map(r=>r.id);
    const emails = usersRows.map(r=>r.email).filter(Boolean);
    console.log(`Found ${ids.length} users. Deleting...`);

    if(emails.length){
      // delete OTPs for these emails
      await conn.query(`DELETE FROM otps WHERE email IN (${emails.map(()=>'?').join(',')})`, emails);
      console.log(`Deleted OTPs for ${emails.length} emails.`);
    }

    // delete ride requests created by these users
    await conn.query(`DELETE FROM ride_requests WHERE user_id IN (${ids.map(()=>'?').join(',')})`, ids);
    console.log('Deleted related ride_requests');

    // nullify driver.user_id mapping
    await conn.query(`UPDATE drivers SET user_id = NULL WHERE user_id IN (${ids.map(()=>'?').join(',')})`, ids);
    console.log('Cleared drivers.user_id for deleted users');

    // finally delete users
    const [res] = await conn.query(`DELETE FROM users WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
    console.log(`Deleted ${res.affectedRows} users.`);

  }catch(e){
    console.error('Error during deletion:', e.message || e);
  }finally{
    await conn.end();
  }
}

run().catch(e=>{ console.error(e); process.exit(1); });
