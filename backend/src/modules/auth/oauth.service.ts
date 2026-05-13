import { pool } from "../../config/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

interface GoogleProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
}

interface OAuthLoginResult {
  token: string;
  role: string;
  orgRole?: string | null;
  adminRole?: string | null;
  profileComplete?: boolean;
  email: string;
  isNewUser: boolean;
  needsProfileSetup?: boolean;
}

/**
 * Handle Google OAuth callback - find or create user and return JWT
 */
export async function handleGoogleOAuthCallback(
  profile: GoogleProfile,
  userRole: "architect" | "builder" | "dealer"
): Promise<OAuthLoginResult> {
  const googleId = String(profile.id || "");
  const email = (profile.emails?.[0]?.value || "").toLowerCase().trim();
  const displayName = String(profile.displayName || "");

  if (!googleId || !email) {
    throw new Error("Invalid Google profile data");
  }

  // Check if user exists by google_id
  let userRow = await pool.query(
    `SELECT id, email, role, organization_id, org_role, admin_role FROM users WHERE google_id = $1`,
    [googleId]
  );

  if (userRow.rows.length > 0) {
    // Existing user - return JWT
    const user = userRow.rows[0];
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        orgRole: user.org_role,
        adminRole: user.admin_role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    let profileComplete = true;
    if (user.role === "builder") {
      const builderProfile = await pool.query(
        `SELECT id FROM builder_profiles WHERE user_id = $1`,
        [user.id]
      );
      profileComplete = builderProfile.rows.length > 0;
    }

    return {
      token,
      role: user.role,
      orgRole: user.org_role,
      adminRole: user.admin_role,
      profileComplete,
      email: user.email,
      isNewUser: false,
    };
  }

  // Check if user exists by email (might have been created with password)
  userRow = await pool.query(
    `SELECT id, email, role, password_hash, google_id, organization_id, org_role, admin_role 
     FROM users WHERE email = $1`,
    [email]
  );

  if (userRow.rows.length > 0) {
    const user = userRow.rows[0];

    // Update existing user with google_id if not already set
    if (!user.google_id) {
      await pool.query(`UPDATE users SET google_id = $1 WHERE id = $2`, [googleId, user.id]);
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        orgRole: user.org_role,
        adminRole: user.admin_role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    let profileComplete = true;
    if (user.role === "builder") {
      const builderProfile = await pool.query(
        `SELECT id FROM builder_profiles WHERE user_id = $1`,
        [user.id]
      );
      profileComplete = builderProfile.rows.length > 0;
    }

    return {
      token,
      role: user.role,
      orgRole: user.org_role,
      adminRole: user.admin_role,
      profileComplete,
      email: user.email,
      isNewUser: false,
    };
  }

  // New user - create account based on requested role
  let newOrgId: string | null = null;

  if (userRole === "architect") {
    // Create organization for architect
    const orgResult = await pool.query(
      `INSERT INTO organizations (name, type) VALUES ($1, $2) RETURNING id`,
      [displayName, "architect"]
    );
    newOrgId = orgResult.rows[0].id;
  }

  // Create new user
  const insertResult = await pool.query(
    `INSERT INTO users (email, role, google_id, organization_id, org_role, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, role, organization_id, org_role, admin_role`,
    [email, userRole, googleId, newOrgId, userRole === "architect" ? "head" : null, null]
  );

  const newUser = insertResult.rows[0];

  const token = jwt.sign(
    {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      organizationId: newUser.organization_id,
      orgRole: newUser.org_role,
      adminRole: newUser.admin_role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    token,
    role: newUser.role,
    orgRole: newUser.org_role,
    adminRole: newUser.admin_role,
    profileComplete: false,
    email: newUser.email,
    isNewUser: true,
    needsProfileSetup: userRole === "builder",
  };
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
}
