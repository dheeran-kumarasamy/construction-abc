import { Pool } from "pg";

const isProduction = process.env.NODE_ENV === "production";
const isVercelRuntime = Boolean(process.env.VERCEL);

function resolveDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    "postgresql://localhost/construction_db"
  );
}

const databaseUrl = resolveDatabaseUrl();

if ((isProduction || isVercelRuntime) && !databaseUrl) {
  throw new Error("Database connection URL is required in production/runtime environment");
}

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
  if (!isProduction && !isVercelRuntime) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    const sslMode = (parsed.searchParams.get("sslmode") || "").toLowerCase();

    if (sslMode === "disable") {
      return undefined;
    }
  } catch {
    // Ignore parse failures and use production-safe fallback.
  }

  return { rejectUnauthorized: false };
}

if ((isProduction || isVercelRuntime) && isLocalDatabaseUrl(databaseUrl)) {
  console.warn(
    "[DB Config] Database URL points to localhost in runtime environment. Set DATABASE_URL or POSTGRES_URL in Vercel project settings."
  );
}

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
