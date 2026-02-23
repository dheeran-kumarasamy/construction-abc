import { pool } from "../../config/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

function getFrontendBaseUrl(referer?: string): string {
  // Try to use the referer header first (most reliable in production)
  if (referer) {
    try {
      const url = new URL(referer);
      return `${url.protocol}//${url.host}`;
    } catch (e) {
      // Fall through to env variables
    }
  }

  // Fall back to environment variables
  const envUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  // Final fallback for local development
  return "http://localhost:5173";
}

function buildInviteLink(token: string, referer?: string): string {
  const baseUrl = getFrontendBaseUrl(referer);
  return `${baseUrl}/accept-invite?token=${token}`;
}

export async function loginUser(email: string, password: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    throw new Error("Email and password required");
  }

  try {
    const { rows } = await pool.query(
    `SELECT u.id, u.password_hash, u.role, u.organization_id
     FROM users u
     WHERE LOWER(TRIM(u.email)) = $1`,
    [normalizedEmail]
  );

  if (rows.length === 0) {
    console.warn("Login failed: user not found", { email: normalizedEmail });
    throw new Error("Invalid credentials");
  }

  const user = rows[0];

  if (!user.password_hash) {
    console.warn("Login failed: user not activated", { email: normalizedEmail });
    throw new Error("User not activated");
  }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      console.warn("Login failed: invalid password", { email: normalizedEmail });
      throw new Error("Invalid credentials");
    }

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
  } catch (err: any) {
    if (err.message === "Invalid credentials" || err.message === "User not activated" || err.message === "Email and password required") {
      throw err;
    }
    console.error("[Auth Service] Database error during login:", err.message);
    throw new Error("Authentication service unavailable");
  }
}

export async function acceptInvite(token: string, password: string) {
  const { rows } = await pool.query(
    `SELECT * FROM user_invites WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
    [token]
  );

  if (rows.length === 0) throw new Error("Invalid or expired invite");

  const invite = rows[0];

  const passwordHash = await bcrypt.hash(password, 10);

  // Check if user already exists
  const existingUserResult = await pool.query(
    `SELECT id, role, organization_id FROM users WHERE email = $1`,
    [invite.email]
  );

  let userId: string;
  let user: any;

  if (existingUserResult.rows.length > 0) {
    // User exists, update their password
    user = existingUserResult.rows[0];
    userId = user.id;
    
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [passwordHash, userId]
    );
  } else {
    // User doesn't exist, create them
    const userInsert = await pool.query(
      `INSERT INTO users (email, password_hash, role, organization_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, role, organization_id`,
      [invite.email, passwordHash, invite.role, invite.organization_id]
    );

    user = userInsert.rows[0];
    userId = user.id;
  }

  await pool.query(
    `UPDATE user_invites SET accepted_at = NOW(), user_id = $1 WHERE id = $2`,
    [userId, invite.id]
  );

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
  projectId?: string | null,
  referer?: string
) {
  const token = crypto.randomBytes(32).toString("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await pool.query(
    `INSERT INTO user_invites (email, role, organization_id, project_id, token, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [email, role, organizationId || null, projectId || null, token, expiresAt]
  );

  const inviteLink = buildInviteLink(token, referer);

  return { inviteLink };
}

export async function listInvites(
  organizationId: string,
  filters?: {
    role?: string;
    projectId?: string;
    status?: "open" | "accepted" | "expired";
    referer?: string;
  }
) {
  const { role, projectId, status } = filters || {};

  const { rows } = await pool.query(
    `SELECT
      ui.id,
      ui.email,
      ui.role,
      ui.project_id,
      ui.token,
      ui.expires_at,
      ui.accepted_at,
      ui.created_at,
      p.name AS project_name,
      CASE
        WHEN ui.accepted_at IS NOT NULL THEN 'accepted'
        WHEN ui.expires_at <= NOW() THEN 'expired'
        ELSE 'open'
      END AS status
     FROM user_invites ui
     LEFT JOIN projects p ON p.id = ui.project_id
     WHERE ui.organization_id = $1
       AND ($2::text IS NULL OR ui.role = $2)
       AND ($3::uuid IS NULL OR ui.project_id = $3)
       AND (
         $4::text IS NULL
         OR (
           CASE
             WHEN ui.accepted_at IS NOT NULL THEN 'accepted'
             WHEN ui.expires_at <= NOW() THEN 'expired'
             ELSE 'open'
           END
         ) = $4
       )
     ORDER BY ui.created_at DESC`,
    [organizationId, role || null, projectId || null, status || null]
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    projectId: row.project_id,
    projectName: row.project_name,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    inviteLink: buildInviteLink(row.token, filters?.referer),
  }));
}
