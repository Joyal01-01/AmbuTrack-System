import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run(){
  const db = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const [rows] = await db.execute('SHOW CREATE TABLE users');
  console.log(rows[0]['Create Table']);
  await db.end();
}
run().catch(e=>console.error(e));
