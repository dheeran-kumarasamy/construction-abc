import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL || "postgresql://localhost/construction_db";

console.log("[DB Config] Connecting to:", databaseUrl.replace(/:[^@]*@/, ":***@")); // Log without password

export const pool = new Pool({
  connectionString: databaseUrl,
});

pool.on("error", (err) => {
  console.error("[DB Pool Error]", err.message);
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
