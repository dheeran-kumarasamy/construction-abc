import bcrypt from "bcryptjs";
import pool from "../db/pool";

function getArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return undefined;
}

async function seedClient() {
  const email = String(
    process.env.CLIENT_EMAIL || getArg("--email") || "client@example.com"
  )
    .trim()
    .toLowerCase();
  const password = String(
    process.env.CLIENT_PASSWORD || getArg("--password") || "test1234"
  );

  if (!email || !password) {
    throw new Error("CLIENT_EMAIL and CLIENT_PASSWORD are required");
  }

  if (password.length < 6) {
    throw new Error("Client password must be at least 6 characters");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await pool.query("BEGIN");

    const existing = await pool.query(
      `SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
      [email]
    );

    if (existing.rows.length > 0) {
      const userId = existing.rows[0].id;
      await pool.query(
        `UPDATE users
         SET password_hash = $1,
             role = 'client',
             organization_id = NULL,
             org_role = NULL,
             is_active = true
         WHERE id = $2`,
        [passwordHash, userId]
      );

      await pool.query("COMMIT");
      console.log(`Updated existing user as client: ${email}`);
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
      return;
    }

    await pool.query(
      `INSERT INTO users (email, password_hash, role, organization_id, org_role, is_active)
       VALUES ($1, $2, 'client', NULL, NULL, true)`,
      [email, passwordHash]
    );

    await pool.query("COMMIT");
    console.log(`Created client user: ${email}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    await pool.end();
  }
}

seedClient().catch((error) => {
  console.error("Failed to seed client user:", error.message || error);
  process.exit(1);
});
