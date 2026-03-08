import { Pool } from "pg";

const isProduction = process.env.NODE_ENV === "production";
const isVercelRuntime = Boolean(process.env.VERCEL);
let schemaHealthCheckStarted = false;

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

export async function logCriticalSchemaHealth() {
  try {
    const { rows } = await pool.query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'users' AND column_name = 'org_role')
           OR (table_name = 'user_invites' AND column_name = 'org_role')
         )`
    );

    const found = new Set(rows.map((row: any) => `${row.table_name}.${row.column_name}`));
    const required = ["users.org_role", "user_invites.org_role"];
    const missing = required.filter((item) => !found.has(item));

    if (missing.length) {
      console.error(
        `[DB Schema] Missing required columns: ${missing.join(", ")}. Apply migration 010_add_org_role_for_architects.sql to this database.`
      );
      return;
    }

    console.log("[DB Schema] Critical migration columns are present.");
  } catch (err: any) {
    console.error("[DB Schema] Unable to verify schema health:", err?.message || err);
  }
}

export function startSchemaHealthCheckOnce() {
  if (schemaHealthCheckStarted) {
    return;
  }
  schemaHealthCheckStarted = true;

  void logCriticalSchemaHealth();
}
