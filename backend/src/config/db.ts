import { Pool } from "pg";

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required in production");
}

const databaseUrl = process.env.DATABASE_URL || "postgresql://localhost/construction_db";

function isLocalDatabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = (parsed.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

function resolveSslOption(url: string) {
  if (!isProduction) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    const sslMode = (parsed.searchParams.get("sslmode") || "").toLowerCase();

    if (sslMode === "disable") {
      return undefined;
    }
  } catch {
    // Ignore URL parse failures and fall back to production default SSL below.
  }

  return { rejectUnauthorized: false };
}

if (isProduction && isLocalDatabaseUrl(databaseUrl)) {
  console.warn("[DB Config] DATABASE_URL points to localhost in production. Set a managed Postgres URL in Vercel environment variables.");
}

console.log("[DB Config] Connecting to:", databaseUrl.replace(/:[^@]*@/, ":***@")); // Log without password

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: resolveSslOption(databaseUrl),
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
