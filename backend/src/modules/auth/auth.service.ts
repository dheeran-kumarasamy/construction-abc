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

function normalizeOrgRole(role?: string | null): "head" | "member" | null {
  const raw = String(role || "").trim().toLowerCase();
  if (raw === "head") return "head";
  if (raw === "member") return "member";
  return null;
}

export async function registerUser(input: {
  email: string;
  password: string;
  role: "architect" | "builder" | "dealer";
  organizationName?: string;
  dealerData?: {
    shopName: string;
    location?: string;
    contactNumber?: string;
    city?: string;
    state?: string;
  };
}) {
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const requestedRole = String(input.role || "").trim().toLowerCase();
  const organizationName = String(input.organizationName || "").trim();
  const dealerData = input.dealerData;
  const hasDealerProfile = Boolean(String(dealerData?.shopName || "").trim());

  // Backward-compatible normalization for older clients that may still send role=builder.
  let role = requestedRole;
  if (requestedRole === "builder" && hasDealerProfile) {
    role = "dealer";
  }
  if (requestedRole === "builder" && organizationName) {
    role = "architect";
  }

  if (!email || !password || !role) {
    throw new Error("email, password and role are required");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  if (role === "builder") {
    throw new Error("Builder self-registration is disabled. Builder accounts are created via invite links only");
  }

  if (role === "architect" && !organizationName) {
    throw new Error("organizationName is required for architect registration");
  }

  if (role === "dealer" && !dealerData?.shopName) {
    throw new Error("shopName is required for dealer registration");
  }

  if (role !== "architect" && role !== "dealer") {
    throw new Error("Invalid role. Supported roles are: architect, dealer");
  }

  const existing = await pool.query(
    `SELECT id, role FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
    [email]
  );

  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let organizationId: string | null = null;
    let orgRole: string | null = null;
    let userRes: any;

    if (role === "architect") {
      const orgRes = await client.query(
        `INSERT INTO organizations (name, type)
         VALUES ($1, 'architect')
         RETURNING id`,
        [organizationName]
      );

      organizationId = orgRes.rows[0].id;
      orgRole = "head";

      if (existing.rows.length > 0) {
        const existingRole = String(existing.rows[0].role || "").toLowerCase();

        if (existingRole !== "builder") {
          throw new Error("User already exists with this email");
        }

        userRes = await client.query(
          `UPDATE users
           SET password_hash = $1,
               role = 'architect',
               organization_id = $2,
               org_role = $3
           WHERE id = $4
           RETURNING id, role, organization_id, org_role`,
          [passwordHash, organizationId, orgRole, existing.rows[0].id]
        );
      } else {
        userRes = await client.query(
          `INSERT INTO users (email, password_hash, role, organization_id, org_role)
           VALUES ($1, $2, 'architect', $3, $4)
           RETURNING id, role, organization_id, org_role`,
          [email, passwordHash, organizationId, orgRole]
        );
      }
    } else if (role === "dealer") {
      if (existing.rows.length > 0) {
        throw new Error("User already exists with this email");
      }

      userRes = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'dealer')
         RETURNING id, role`,
        [email, passwordHash]
      );

      const userId = userRes.rows[0].id;

      // Create dealer profile
      await client.query(
        `INSERT INTO dealers (user_id, shop_name, email, location, contact_number, city, state)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          dealerData!.shopName,
          email,
          dealerData?.location || null,
          dealerData?.contactNumber || null,
          dealerData?.city || null,
          dealerData?.state || null,
        ]
      );
    }

    await client.query("COMMIT");

    const user = userRes.rows[0];
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        organizationId: user.organization_id || null,
        orgRole: user.org_role || null,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return {
      token,
      role: user.role,
      organizationId: user.organization_id || null,
      orgRole: user.org_role || null,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function loginUser(email: string, password: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    throw new Error("Email and password required");
  }

  try {
    const { rows } = await pool.query(
    `SELECT u.id, u.password_hash, u.role, u.organization_id, u.org_role
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
        orgRole: user.org_role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return { token, role: user.role, organizationId: user.organization_id, orgRole: user.org_role };
  } catch (err: any) {
    if (err.message === "Invalid credentials" || err.message === "User not activated" || err.message === "Email and password required") {
      throw err;
    }
    console.error("[Auth Service] Database error during login:", err.message);
    throw new Error("Authentication service unavailable");
  }
}

export async function resetPassword(email: string, newPassword: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const password = String(newPassword || "");

  if (!normalizedEmail || !password) {
    throw new Error("Email and new password are required");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const existingUser = await pool.query(
    `SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
    [normalizedEmail]
  );

  if (!existingUser.rows.length) {
    throw new Error("User not found");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `UPDATE users
     SET password_hash = $1
     WHERE id = $2`,
    [passwordHash, existingUser.rows[0].id]
  );

  return { ok: true };
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
  const inviteOrgRole = normalizeOrgRole(invite.org_role);

  const existingUserResult = await pool.query(
    `SELECT id, role, organization_id, org_role FROM users WHERE email = $1`,
    [invite.email]
  );

  let userId: string;
  let user: any;

  if (existingUserResult.rows.length > 0) {
    // User exists, update their password
    user = existingUserResult.rows[0];
    userId = user.id;

    const shouldUpdateOrgRole = invite.role === "architect" ? inviteOrgRole || "member" : user.org_role;

    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           role = COALESCE($2, role),
           organization_id = COALESCE($3, organization_id),
           org_role = COALESCE($4, org_role)
       WHERE id = $5`,
      [passwordHash, invite.role || null, invite.organization_id || null, shouldUpdateOrgRole, userId]
    );

    const refreshed = await pool.query(
      `SELECT id, role, organization_id, org_role FROM users WHERE id = $1`,
      [userId]
    );
    user = refreshed.rows[0];
  } else {
    // User doesn't exist, create them
    const userInsert = await pool.query(
      `INSERT INTO users (email, password_hash, role, organization_id, org_role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, role, organization_id, org_role`,
      [invite.email, passwordHash, invite.role, invite.organization_id, invite.role === "architect" ? inviteOrgRole || "member" : null]
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
      orgRole: user.org_role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return { token: jwtToken, role: user.role, organizationId: user.organization_id, orgRole: user.org_role };
}

export async function createInvite(
  email: string,
  role: string,
  organizationId: string,
  projectId?: string | null,
  orgRole?: "head" | "member" | null,
  referer?: string
) {
  const token = crypto.randomBytes(32).toString("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await pool.query(
    `INSERT INTO user_invites (email, role, organization_id, project_id, org_role, token, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [email, role, organizationId || null, projectId || null, orgRole || null, token, expiresAt]
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
