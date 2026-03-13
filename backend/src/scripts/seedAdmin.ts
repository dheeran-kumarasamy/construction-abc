import bcrypt from "bcryptjs";
import pool from "../db/pool";

function getArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return undefined;
}

async function seedAdmin() {
  const email = String(
    process.env.ADMIN_EMAIL || getArg("--email") || "admin@constructionabc.local"
  )
    .trim()
    .toLowerCase();
  const password = String(
    process.env.ADMIN_PASSWORD || getArg("--password") || "Admin@12345"
  );

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }

  if (password.length < 6) {
    throw new Error("Admin password must be at least 6 characters");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await pool.query("BEGIN");

    const existing = await pool.query(
      `SELECT id, email, role FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
      [email]
    );

    if (existing.rows.length > 0) {
      const userId = existing.rows[0].id;
      await pool.query(
        `UPDATE users
         SET password_hash = $1,
             role = 'admin',
             organization_id = NULL,
             org_role = NULL,
             is_active = true
         WHERE id = $2`,
        [passwordHash, userId]
      );

      await pool.query("COMMIT");
      console.log(`Updated existing user as admin: ${email}`);
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
      return;
    }

    await pool.query(
      `INSERT INTO users (email, password_hash, role, organization_id, org_role, is_active)
       VALUES ($1, $2, 'admin', NULL, NULL, true)`,
      [email, passwordHash]
    );

    await pool.query("COMMIT");
    console.log(`Created admin user: ${email}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    await pool.end();
  }
}

seedAdmin().catch((error) => {
  console.error("Failed to seed admin user:", error.message || error);
  process.exit(1);
});
