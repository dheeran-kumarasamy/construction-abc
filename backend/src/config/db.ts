import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://localhost/construction_db",
});

export async function testDbConnection() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT NOW()");
    console.log("✅ DB connected at:", res.rows[0].now);
  } finally {
    client.release();
  }
}
