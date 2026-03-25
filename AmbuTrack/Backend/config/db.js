import mysql from "mysql2";
import dotenv from "dotenv";
dotenv.config();

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "joyal",
  database: process.env.DB_NAME || "ambutrack"
});

export default db;