import { pool } from "../../config/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export async function loginUser(email: string, password: string) {
  const { rows } = await pool.query(
    `SELECT u.id, u.password_hash, u.role, u.organization_id
     FROM users u
     WHERE u.email = $1`,
    [email]
  );

  if (rows.length === 0) throw new Error("Invalid credentials");

  const user = rows[0];

  if (!user.password_hash) throw new Error("User not activated");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error("Invalid credentials");

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      organizationId: user.organization_id,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return { token, role: user.role };
}

export async function acceptInvite(token: string, password: string) {
  const { rows } = await pool.query(
    `SELECT * FROM user_invites WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
    [token]
  );

  if (rows.length === 0) throw new Error("Invalid or expired invite");

  const invite = rows[0];

  const passwordHash = await bcrypt.hash(password, 10);

  const userInsert = await pool.query(
    `INSERT INTO users (email, password_hash, role, organization_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, role, organization_id`,
    [invite.email, passwordHash, invite.role, invite.organization_id]
  );

  await pool.query(
    `UPDATE user_invites SET accepted_at = NOW() WHERE id = $1`,
    [invite.id]
  );

  const user = userInsert.rows[0];

  const jwtToken = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      organizationId: user.organization_id,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return { token: jwtToken, role: user.role };
}

export async function createInvite(
  email: string,
  role: string,
  organizationId: string,
  projectId?: string | null
) {
  const token = crypto.randomBytes(32).toString("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await pool.query(
    `INSERT INTO user_invites (email, role, organization_id, project_id, token, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [email, role, organizationId || null, projectId || null, token, expiresAt]
  );

  const inviteLink = `http://localhost:5173/accept-invite?token=${token}`;

  return { inviteLink };
}
