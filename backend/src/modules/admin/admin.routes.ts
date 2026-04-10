import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { unlink } from "fs/promises";
import { pool } from "../../config/db";
import { authenticate, requireAdmin, requireSuperAdmin } from "../auth/auth.middleware";
import { runScrapers, runLabourScraper, runAllMaterialsScraper } from "../../services/scrapers";

// Canonical list of admin module keys — must stay in sync with frontend navItems
const ALL_MODULE_KEYS = [
  "overview",
  "users",
  "organizations",
  "projects",
  "boqs",
  "invites",
  "dealers",
  "estimation-projects",
  "estimates",
  "deviations",
  "rates-analysis",
  "prices",
  "audit",
] as const;

type ModuleKey = (typeof ALL_MODULE_KEYS)[number];

// Maps request path prefixes to module keys for access control
const MODULE_PATH_MAP: Array<{ pattern: RegExp; key: ModuleKey }> = [
  { pattern: /^\/dashboard/, key: "overview" },
  { pattern: /^\/users/, key: "users" },
  { pattern: /^\/organizations/, key: "organizations" },
  { pattern: /^\/projects/, key: "projects" },
  { pattern: /^\/boqs/, key: "boqs" },
  { pattern: /^\/invites/, key: "invites" },
  { pattern: /^\/dealers/, key: "dealers" },
  { pattern: /^\/estimation-projects/, key: "estimation-projects" },
  { pattern: /^\/estimates/, key: "estimates" },
  { pattern: /^\/deviation-alerts/, key: "deviations" },
  { pattern: /^\/rates-analysis/, key: "rates-analysis" },
  { pattern: /^\/prices/, key: "prices" },
  { pattern: /^\/audit-logs/, key: "audit" },
  { pattern: /^\/scrapers/, key: "overview" },
];

async function moduleAccessGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;

  // Super admin (and legacy tokens without adminRole) get full access.
  const adminRole = String(user?.adminRole || "super_admin");
  if (adminRole === "super_admin") {
    return next();
  }

  // team and my-permissions endpoints are always accessible to any admin
  if (/^\/(team|my-permissions)/.test(req.path)) {
    return next();
  }

  const matched = MODULE_PATH_MAP.find(({ pattern }) => pattern.test(req.path));
  if (!matched) {
    // Unknown path — allow; the route handler will decide what to return
    return next();
  }

  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM admin_module_permissions
       WHERE user_id = $1 AND module_key = $2
       LIMIT 1`,
      [user.userId, matched.key]
    );

    if (!rows.length) {
      return res.status(403).json({ error: "Access to this module is restricted" });
    }

    return next();
  } catch (err) {
    console.error("Module access check failed", err);
    return res.status(500).json({ error: "Access check failed" });
  }
}

const router = Router();

function parsePagination(req: Request) {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function getAdminUserId(req: Request): string {
  return String((req as any).user?.userId || "");
}

function getFrontendBaseUrl(): string {
  const envUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  return "http://localhost:5173";
}

function buildInviteLink(token: string) {
  return `${getFrontendBaseUrl()}/accept-invite?token=${token}`;
}

async function logAdminAction(req: Request, action: string, metadata: Record<string, unknown>) {
  const adminUserId = getAdminUserId(req);
  if (!adminUserId) {
    return;
  }

  await pool.query(
    `INSERT INTO audit_logs (project_id, user_id, action, metadata)
     VALUES (NULL, $1, $2, $3::jsonb)`,
    [adminUserId, action, JSON.stringify(metadata)]
  );
}

router.use(authenticate, requireAdmin, moduleAccessGuard);

// --- My permissions (any admin) ---
router.get("/my-permissions", async (req: Request, res: Response) => {
  const user = (req as any).user;
  const adminRole = String(user?.adminRole || "super_admin");

  if (adminRole === "super_admin") {
    return res.json({ adminRole: "super_admin", modules: [...ALL_MODULE_KEYS] });
  }

  try {
    const { rows } = await pool.query(
      `SELECT module_key FROM admin_module_permissions WHERE user_id = $1`,
      [user.userId]
    );
    return res.json({
      adminRole: "admin_team",
      modules: rows.map((r: any) => r.module_key as ModuleKey),
    });
  } catch (err) {
    console.error("Failed to fetch permissions", err);
    return res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

// --- Admin team management (super_admin only) ---
router.get("/team", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.admin_role, u.is_active, u.created_at, u.last_login_at,
              COALESCE(
                json_agg(amp.module_key ORDER BY amp.module_key)
                  FILTER (WHERE amp.module_key IS NOT NULL),
                '[]'
              ) AS modules
       FROM users u
       LEFT JOIN admin_module_permissions amp ON amp.user_id = u.id
       WHERE u.role = 'admin'
       GROUP BY u.id
       ORDER BY u.admin_role ASC, u.created_at ASC`
    );
    return res.json({ items: rows });
  } catch (err) {
    console.error("Failed to list admin team", err);
    return res.status(500).json({ error: "Failed to list admin team" });
  }
});

router.post("/team", requireSuperAdmin, async (req: Request, res: Response) => {
  const { email, password, modules } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const plainPassword = String(password || "").trim();
  const moduleKeys: string[] = Array.isArray(modules) ? modules : [];

  if (!normalizedEmail || !plainPassword) {
    return res.status(400).json({ error: "email and password are required" });
  }

  if (plainPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const invalidKeys = moduleKeys.filter((k) => !(ALL_MODULE_KEYS as readonly string[]).includes(k));
  if (invalidKeys.length) {
    return res.status(400).json({ error: `Invalid module keys: ${invalidKeys.join(", ")}` });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
      [normalizedEmail]
    );
    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const grantedBy = getAdminUserId(req);

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, role, admin_role, is_active)
       VALUES ($1, $2, 'admin', 'admin_team', true)
       RETURNING id, email, admin_role, is_active, created_at`,
      [normalizedEmail, passwordHash]
    );
    const newUser = userRes.rows[0];

    if (moduleKeys.length) {
      const values = moduleKeys
        .map((_, i) => `($1, $${i + 2}, $${moduleKeys.length + 2})`)
        .join(", ");
      await client.query(
        `INSERT INTO admin_module_permissions (user_id, module_key, granted_by) VALUES ${values}`,
        [newUser.id, ...moduleKeys, grantedBy || null]
      );
    }

    await client.query("COMMIT");

    await logAdminAction(req, "admin.team.create", { newUserId: newUser.id, email: normalizedEmail, modules: moduleKeys });

    return res.status(201).json({ ...newUser, modules: moduleKeys });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to create admin team user", err);
    return res.status(500).json({ error: "Failed to create admin team user" });
  } finally {
    client.release();
  }
});

router.put("/team/:userId/permissions", requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = String(req.params.userId || "");
  const { modules } = req.body || {};
  const moduleKeys: string[] = Array.isArray(modules) ? modules : [];

  const invalidKeys = moduleKeys.filter((k) => !(ALL_MODULE_KEYS as readonly string[]).includes(k));
  if (invalidKeys.length) {
    return res.status(400).json({ error: `Invalid module keys: ${invalidKeys.join(", ")}` });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userCheck = await client.query(
      `SELECT id, admin_role FROM users WHERE id = $1 AND role = 'admin' LIMIT 1`,
      [userId]
    );
    if (!userCheck.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Admin team user not found" });
    }
    if (userCheck.rows[0].admin_role !== "admin_team") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Permissions can only be set on admin_team users" });
    }

    const grantedBy = getAdminUserId(req);

    await client.query(`DELETE FROM admin_module_permissions WHERE user_id = $1`, [userId]);

    if (moduleKeys.length) {
      const values = moduleKeys
        .map((_, i) => `($1, $${i + 2}, $${moduleKeys.length + 2})`)
        .join(", ");
      await client.query(
        `INSERT INTO admin_module_permissions (user_id, module_key, granted_by) VALUES ${values}`,
        [userId, ...moduleKeys, grantedBy || null]
      );
    }

    await client.query("COMMIT");

    await logAdminAction(req, "admin.team.permissions_update", { targetUserId: userId, modules: moduleKeys });

    return res.json({ success: true, userId, modules: moduleKeys });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to update permissions", err);
    return res.status(500).json({ error: "Failed to update permissions" });
  } finally {
    client.release();
  }
});

router.delete("/team/:userId", requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = String(req.params.userId || "");
  const requesterId = getAdminUserId(req);

  if (userId === requesterId) {
    return res.status(400).json({ error: "You cannot remove yourself from the admin team" });
  }

  try {
    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 AND role = 'admin' AND admin_role = 'admin_team' RETURNING id, email`,
      [userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Admin team user not found" });
    }

    await logAdminAction(req, "admin.team.delete", { targetUserId: userId, email: result.rows[0].email });

    return res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete admin team user", err);
    return res.status(500).json({ error: "Failed to delete admin team user" });
  }
});

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const [users, organizations, projects, estimates, boqs, dealers, activeAlerts, deviationAlerts, recentActivity, lastScraperRun] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM users`),
      pool.query(`SELECT COUNT(*)::int AS count FROM organizations`),
      pool.query(`SELECT COUNT(*)::int AS count FROM projects`),
      pool.query(`SELECT COUNT(*)::int AS count FROM estimates`),
      pool.query(`SELECT COUNT(*)::int AS count FROM boqs`),
      pool.query(`SELECT COUNT(*)::int AS count FROM dealers`),
      pool.query(`SELECT COUNT(*)::int AS count FROM price_alerts WHERE is_active = true`),
      pool.query(`SELECT COUNT(*)::int AS count FROM audit_logs WHERE action = 'ESTIMATE_MARKET_DEVIATION_ALERT'`),
      pool.query(
        `SELECT al.id, al.action, al.metadata, al.created_at, u.email AS user_email
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ORDER BY al.created_at DESC
         LIMIT 20`
      ),
      pool.query(
        `SELECT created_at
         FROM audit_logs
         WHERE action = 'admin.scrapers.run'
         ORDER BY created_at DESC
         LIMIT 1`
      ),
    ]);

    return res.json({
      summary: {
        users: users.rows[0]?.count || 0,
        organizations: organizations.rows[0]?.count || 0,
        projects: projects.rows[0]?.count || 0,
        estimates: estimates.rows[0]?.count || 0,
        boqUploads: boqs.rows[0]?.count || 0,
        dealers: dealers.rows[0]?.count || 0,
        activePriceAlerts: activeAlerts.rows[0]?.count || 0,
        marketDeviationAlerts: deviationAlerts.rows[0]?.count || 0,
      },
      recentActivity: recentActivity.rows,
      systemHealth: {
        database: "connected",
        lastScraperRunAt: lastScraperRun.rows[0]?.created_at || null,
      },
    });
  } catch (error) {
    console.error("Failed to fetch admin dashboard", error);
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
});

router.get("/deviation-alerts", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);
    const minDeviationPercent = Math.max(0, Number(req.query.minDeviationPercent || 0));
    const statusFilterRaw = String(req.query.status || "open").toLowerCase();
    const statusFilter = ["open", "resolved", "all"].includes(statusFilterRaw)
      ? statusFilterRaw
      : "open";
    const directionFilterRaw = String(req.query.direction || "all").toLowerCase();
    const directionFilter = ["all", "above_market", "below_market", "mixed"].includes(directionFilterRaw)
      ? directionFilterRaw
      : "all";

    const statusCountWhere =
      statusFilter === "all"
        ? ""
        : statusFilter === "resolved"
          ? `AND EXISTS (
               SELECT 1
               FROM audit_logs rs
               WHERE rs.action = 'ESTIMATE_MARKET_DEVIATION_RESOLVED'
                 AND (rs.metadata->>'alertId') = al.id::text
             )`
          : `AND NOT EXISTS (
               SELECT 1
               FROM audit_logs rs
               WHERE rs.action = 'ESTIMATE_MARKET_DEVIATION_RESOLVED'
                 AND (rs.metadata->>'alertId') = al.id::text
             )`;

    const resolvedDirectionSql = `COALESCE(
      NULLIF(al.metadata->>'deviationDirection', ''),
      CASE
        WHEN COALESCE((al.metadata->>'belowMarketCount')::int, 0) > 0
             AND COALESCE((al.metadata->>'aboveMarketCount')::int, 0) > 0
          THEN 'mixed'
        WHEN COALESCE((al.metadata->>'belowMarketCount')::int, 0) > 0
          THEN 'below_market'
        ELSE 'above_market'
      END
    )`;
    const directionCountWhere = directionFilter === "all"
      ? ""
      : `AND ${resolvedDirectionSql} = $2`;

    const totalParams = directionFilter === "all"
      ? [minDeviationPercent]
      : [minDeviationPercent, directionFilter];

    const totalQuery = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM audit_logs al
       WHERE al.action = 'ESTIMATE_MARKET_DEVIATION_ALERT'
         AND COALESCE((al.metadata->>'maxDeviationPercent')::numeric, 0) >= $1
         ${directionCountWhere}
         ${statusCountWhere}`,
      totalParams
    );

    const directionCountsQuery = await pool.query(
      `SELECT
         ${resolvedDirectionSql} AS direction,
         COUNT(*)::int AS count
       FROM audit_logs al
       WHERE al.action = 'ESTIMATE_MARKET_DEVIATION_ALERT'
         AND COALESCE((al.metadata->>'maxDeviationPercent')::numeric, 0) >= $1
         ${statusCountWhere}
       GROUP BY 1`,
      [minDeviationPercent]
    );

    const directionCounts = {
      all: 0,
      above_market: 0,
      below_market: 0,
      mixed: 0,
    } as Record<string, number>;

    for (const row of directionCountsQuery.rows || []) {
      const key = String(row.direction || "above_market");
      const count = Number(row.count || 0);
      if (Object.prototype.hasOwnProperty.call(directionCounts, key)) {
        directionCounts[key] = count;
      }
      directionCounts.all += count;
    }

    const directionRowsWhere = directionFilter === "all"
      ? ""
      : `AND ${resolvedDirectionSql} = $2`;

    const rowParams = directionFilter === "all"
      ? [minDeviationPercent, pageSize, offset]
      : [minDeviationPercent, directionFilter, pageSize, offset];

    const rowLimitIndex = directionFilter === "all" ? 2 : 3;
    const rowOffsetIndex = directionFilter === "all" ? 3 : 4;

    const rows = await pool.query(
      `SELECT al.id, al.project_id, al.user_id, u.email AS user_email,
              al.action, al.metadata, al.created_at,
              resolved.resolved_at,
              resolved.resolved_by_user_id,
              resolved.resolved_by_email,
              resolved.resolved_note
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       LEFT JOIN LATERAL (
         SELECT
           rs.created_at AS resolved_at,
           rs.user_id AS resolved_by_user_id,
           ru.email AS resolved_by_email,
           (rs.metadata->>'note') AS resolved_note
         FROM audit_logs rs
         LEFT JOIN users ru ON ru.id = rs.user_id
         WHERE rs.action = 'ESTIMATE_MARKET_DEVIATION_RESOLVED'
           AND (rs.metadata->>'alertId') = al.id::text
         ORDER BY rs.created_at DESC
         LIMIT 1
       ) resolved ON true
       WHERE al.action = 'ESTIMATE_MARKET_DEVIATION_ALERT'
         AND COALESCE((al.metadata->>'maxDeviationPercent')::numeric, 0) >= $1
         ${directionRowsWhere}
         ${
           statusFilter === "all"
             ? ""
             : statusFilter === "resolved"
               ? "AND resolved.resolved_at IS NOT NULL"
               : "AND resolved.resolved_at IS NULL"
         }
       ORDER BY al.created_at DESC
       LIMIT $${rowLimitIndex} OFFSET $${rowOffsetIndex}`,
      rowParams
    );

    return res.json({
      items: rows.rows,
      pagination: { page, pageSize, total: totalQuery.rows[0]?.count || 0 },
      directionCounts,
    });
  } catch (error) {
    console.error("Failed to list deviation alerts", error);
    return res.status(500).json({ error: "Failed to list deviation alerts" });
  }
});

router.post("/deviation-alerts/:alertId/resolve", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const alertId = String(req.params.alertId || "");
    const note = String(req.body?.note || "").trim();
    const resolverUserId = getAdminUserId(req);

    if (!resolverUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await client.query("BEGIN");

    const alertResult = await client.query(
      `SELECT id, project_id
       FROM audit_logs
       WHERE id = $1
         AND action = 'ESTIMATE_MARKET_DEVIATION_ALERT'
       LIMIT 1`,
      [alertId]
    );

    if (!alertResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Deviation alert not found" });
    }

    const alreadyResolved = await client.query(
      `SELECT id
       FROM audit_logs
       WHERE action = 'ESTIMATE_MARKET_DEVIATION_RESOLVED'
         AND (metadata->>'alertId') = $1
       LIMIT 1`,
      [alertId]
    );

    if (alreadyResolved.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Deviation alert already resolved" });
    }

    await client.query(
      `INSERT INTO audit_logs (project_id, user_id, action, metadata)
       VALUES ($1, $2, 'ESTIMATE_MARKET_DEVIATION_RESOLVED', $3::jsonb)`,
      [
        alertResult.rows[0].project_id || null,
        resolverUserId,
        JSON.stringify({ alertId, note: note || null }),
      ]
    );

    await client.query("COMMIT");
    return res.json({ success: true, alertId, resolved: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to resolve deviation alert", error);
    return res.status(500).json({ error: "Failed to resolve deviation alert" });
  } finally {
    client.release();
  }
});

router.get("/users", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);
    const role = String(req.query.role || "").trim().toLowerCase();
    const search = String(req.query.search || "").trim().toLowerCase();

    const where: string[] = [];
    const params: Array<string | number> = [];

    if (role) {
      params.push(role);
      where.push(`LOWER(u.role) = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`LOWER(u.email) LIKE $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countQuery = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM users u
       ${whereClause}`,
      params
    );

    params.push(pageSize, offset);

    const rows = await pool.query(
      `SELECT u.id, u.email, u.role, u.org_role, u.organization_id, u.created_at,
              u.last_login_at, COALESCE(u.is_active, true) AS is_active,
              o.name AS organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      items: rows.rows,
      pagination: {
        page,
        pageSize,
        total: countQuery.rows[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error("Failed to list users", error);
    return res.status(500).json({ error: "Failed to list users" });
  }
});

router.get("/users/:userId", async (req: Request, res: Response) => {
  try {
    const userId = String(req.params.userId || "");

    const userQuery = await pool.query(
      `SELECT u.id, u.email, u.role, u.org_role, u.organization_id, u.created_at,
              u.last_login_at, COALESCE(u.is_active, true) AS is_active,
              o.name AS organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1
       LIMIT 1`,
      [userId]
    );

    if (!userQuery.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const [projects, invites, dealerProfile] = await Promise.all([
      pool.query(
        `SELECT id, name, description, created_at
         FROM projects
         WHERE architect_id = $1 OR client_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      ),
      pool.query(
        `SELECT id, email, role, project_id, organization_id, created_at, expires_at, accepted_at
         FROM user_invites
         WHERE user_id = $1 OR LOWER(TRIM(email)) = (
           SELECT LOWER(TRIM(email)) FROM users WHERE id = $1
         )
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      ),
      pool.query(
        `SELECT *
         FROM dealers
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      ),
    ]);

    return res.json({
      user: userQuery.rows[0],
      projects: projects.rows,
      invites: invites.rows,
      dealerProfile: dealerProfile.rows[0] || null,
    });
  } catch (error) {
    console.error("Failed to fetch user detail", error);
    return res.status(500).json({ error: "Failed to fetch user detail" });
  }
});

router.patch("/users/:userId", async (req: Request, res: Response) => {
  try {
    const userId = String(req.params.userId || "");
    const { role, orgRole, organizationId, isActive } = req.body || {};

    const updates: string[] = [];
    const params: Array<string | boolean | null> = [];

    if (role !== undefined) {
      const normalizedRole = String(role).trim().toLowerCase();
      if (!["architect", "builder", "client", "dealer", "admin"].includes(normalizedRole)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      params.push(normalizedRole);
      updates.push(`role = $${params.length}`);
    }

    if (orgRole !== undefined) {
      const normalizedOrgRole = String(orgRole || "").trim().toLowerCase();
      if (normalizedOrgRole && normalizedOrgRole !== "head" && normalizedOrgRole !== "member") {
        return res.status(400).json({ error: "Invalid orgRole" });
      }
      params.push(normalizedOrgRole || null);
      updates.push(`org_role = $${params.length}`);
    }

    if (organizationId !== undefined) {
      params.push(organizationId || null);
      updates.push(`organization_id = $${params.length}`);
    }

    if (isActive !== undefined) {
      params.push(Boolean(isActive));
      updates.push(`is_active = $${params.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No fields provided" });
    }

    params.push(userId);

    const result = await pool.query(
      `UPDATE users
       SET ${updates.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, email, role, org_role, organization_id, COALESCE(is_active, true) AS is_active`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    await logAdminAction(req, "admin.users.update", {
      targetUserId: userId,
      updatedFields: Object.keys(req.body || {}),
    });

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update user", error);
    return res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:userId", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const mode = String(req.query.mode || "soft").toLowerCase();

    await client.query("BEGIN");

    if (mode === "hard") {
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    } else {
      await client.query(
        `UPDATE users
         SET is_active = false
         WHERE id = $1`,
        [userId]
      );
    }

    await client.query("COMMIT");

    await logAdminAction(req, "admin.users.delete", {
      targetUserId: userId,
      mode,
    });

    return res.json({ success: true, mode });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to delete user", error);
    return res.status(500).json({ error: "Failed to delete user" });
  } finally {
    client.release();
  }
});

router.post("/users/:userId/reset-password", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const tempPassword = crypto.randomBytes(6).toString("base64url");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2
       RETURNING id, email`,
      [passwordHash, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    await logAdminAction(req, "admin.users.reset_password", { targetUserId: userId });

    return res.json({
      success: true,
      user: result.rows[0],
      tempPassword,
    });
  } catch (error) {
    console.error("Failed to reset password", error);
    return res.status(500).json({ error: "Failed to reset password" });
  }
});

router.get("/organizations", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);

    const totalQuery = await pool.query(`SELECT COUNT(*)::int AS count FROM organizations`);
    const rows = await pool.query(
      `SELECT o.id, o.name, o.type, o.created_at,
              (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id) AS member_count,
              (SELECT COUNT(*)::int FROM projects p WHERE p.architect_org_id = o.id OR p.client_org_id = o.id) AS project_count
       FROM organizations o
       ORDER BY o.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return res.json({
      items: rows.rows,
      pagination: { page, pageSize, total: totalQuery.rows[0]?.count || 0 },
    });
  } catch (error) {
    console.error("Failed to list organizations", error);
    return res.status(500).json({ error: "Failed to list organizations" });
  }
});

router.patch("/organizations/:organizationId", async (req: Request, res: Response) => {
  try {
    const organizationId = String(req.params.organizationId || "");
    const { name, type } = req.body || {};

    const updates: string[] = [];
    const params: Array<string> = [];

    if (name !== undefined) {
      const normalizedName = String(name || "").trim();
      if (!normalizedName) {
        return res.status(400).json({ error: "Organization name is required" });
      }
      params.push(normalizedName);
      updates.push(`name = $${params.length}`);
    }

    if (type !== undefined) {
      const normalizedType = String(type || "").trim().toLowerCase();
      if (!["architect", "builder", "client"].includes(normalizedType)) {
        return res.status(400).json({ error: "Invalid organization type" });
      }
      params.push(normalizedType);
      updates.push(`type = $${params.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No fields provided" });
    }

    params.push(organizationId);

    const result = await pool.query(
      `UPDATE organizations
       SET ${updates.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, name, type, created_at`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Organization not found" });
    }

    await logAdminAction(req, "admin.organizations.update", {
      organizationId,
      updatedFields: Object.keys(req.body || {}),
    });

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update organization", error);
    return res.status(500).json({ error: "Failed to update organization" });
  }
});

router.delete("/organizations/:organizationId", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const organizationId = String(req.params.organizationId || "");

    await client.query("BEGIN");

    const impact = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE organization_id = $1) AS user_count,
         (SELECT COUNT(*)::int FROM projects WHERE architect_org_id = $1 OR client_org_id = $1) AS project_count,
         (SELECT COUNT(*)::int FROM user_invites WHERE organization_id = $1) AS invite_count,
         (SELECT COUNT(*)::int FROM dealers WHERE organization_id = $1) AS dealer_count,
         (SELECT COUNT(*)::int FROM estimates WHERE builder_org_id = $1) AS estimate_count,
         (SELECT COUNT(*)::int FROM base_pricing WHERE builder_org_id = $1) AS base_pricing_count,
         (SELECT COUNT(*)::int FROM builder_invitations WHERE builder_org_id = $1) AS builder_invitation_count`,
      [organizationId]
    );

    await client.query(`UPDATE users SET organization_id = NULL, org_role = NULL WHERE organization_id = $1`, [organizationId]);
    await client.query(`UPDATE projects SET architect_org_id = NULL WHERE architect_org_id = $1`, [organizationId]);
    await client.query(`UPDATE projects SET client_org_id = NULL WHERE client_org_id = $1`, [organizationId]);
    await client.query(`UPDATE user_invites SET organization_id = NULL WHERE organization_id = $1`, [organizationId]);
    await client.query(`UPDATE dealers SET organization_id = NULL WHERE organization_id = $1`, [organizationId]);
    await client.query(`UPDATE estimates SET builder_org_id = NULL WHERE builder_org_id = $1`, [organizationId]);
    await client.query(`UPDATE base_pricing SET builder_org_id = NULL WHERE builder_org_id = $1`, [organizationId]);
    await client.query(`UPDATE builder_invitations SET builder_org_id = NULL WHERE builder_org_id = $1`, [organizationId]);

    const result = await client.query(`DELETE FROM organizations WHERE id = $1 RETURNING id`, [organizationId]);
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Organization not found" });
    }

    await client.query("COMMIT");

    await logAdminAction(req, "admin.organizations.delete", {
      organizationId,
      impact: impact.rows[0],
    });

    return res.json({ success: true, impact: impact.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to delete organization", error);
    return res.status(500).json({ error: "Failed to delete organization" });
  } finally {
    client.release();
  }
});

router.get("/projects", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);

    const totalQuery = await pool.query(`SELECT COUNT(*)::int AS count FROM projects`);
    const rows = await pool.query(
      `SELECT p.id, p.name, p.description, p.created_at,
              architect.email AS architect_email,
              client.email AS client_email,
              (SELECT COUNT(*)::int FROM boqs b WHERE b.project_id = p.id) AS boq_count,
              (SELECT COUNT(*)::int FROM estimates e WHERE e.project_id = p.id) AS estimate_count
       FROM projects p
       LEFT JOIN users architect ON architect.id = p.architect_id
       LEFT JOIN users client ON client.id = p.client_id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return res.json({
      items: rows.rows,
      pagination: { page, pageSize, total: totalQuery.rows[0]?.count || 0 },
    });
  } catch (error) {
    console.error("Failed to list projects", error);
    return res.status(500).json({ error: "Failed to list projects" });
  }
});

router.patch("/projects/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.projectId || "");
    const { name, description, architectId, clientId } = req.body || {};

    const updates: string[] = [];
    const params: Array<string | null> = [];

    if (name !== undefined) {
      const normalizedName = String(name || "").trim();
      if (!normalizedName) {
        return res.status(400).json({ error: "Project name is required" });
      }
      params.push(normalizedName);
      updates.push(`name = $${params.length}`);
    }

    if (description !== undefined) {
      params.push(String(description || "").trim() || null);
      updates.push(`description = $${params.length}`);
    }

    if (architectId !== undefined) {
      params.push(architectId || null);
      updates.push(`architect_id = $${params.length}`);
    }

    if (clientId !== undefined) {
      params.push(clientId || null);
      updates.push(`client_id = $${params.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No fields provided" });
    }

    params.push(projectId);

    const result = await pool.query(
      `UPDATE projects
       SET ${updates.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, name, description, architect_id, client_id, created_at`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Project not found" });
    }

    await logAdminAction(req, "admin.projects.update", {
      projectId,
      updatedFields: Object.keys(req.body || {}),
    });

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update project", error);
    return res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:projectId", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const projectId = String(req.params.projectId || "");

    await client.query("BEGIN");

    const impact = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM project_revisions WHERE project_id = $1) AS project_revision_count,
         (SELECT COUNT(*)::int FROM boq_revisions WHERE project_id = $1) AS boq_revision_count,
         (SELECT COUNT(*)::int FROM boqs WHERE project_id = $1) AS boq_count,
         (SELECT COUNT(*)::int FROM builder_invitations WHERE project_id = $1) AS builder_invitation_count,
         (SELECT COUNT(*)::int FROM user_invites WHERE project_id = $1) AS invite_count,
         (SELECT COUNT(*)::int FROM estimates WHERE project_id = $1) AS estimate_count,
         (SELECT COUNT(*)::int FROM awards WHERE project_id = $1) AS award_count,
         (SELECT COUNT(*)::int FROM audit_logs WHERE project_id = $1) AS audit_log_count`,
      [projectId]
    );

    const boqFiles = await client.query(`SELECT file_path FROM boqs WHERE project_id = $1`, [projectId]);
    const estimateIds = await client.query(`SELECT id FROM estimates WHERE project_id = $1`, [projectId]);
    const estimateIdList = estimateIds.rows.map((row) => row.id);

    await client.query(`UPDATE projects SET boq_id = NULL WHERE id = $1`, [projectId]);
    await client.query(`DELETE FROM awards WHERE project_id = $1`, [projectId]);

    if (estimateIdList.length) {
      await client.query(`DELETE FROM awards WHERE estimate_revision_id IN (
        SELECT id FROM estimate_revisions WHERE estimate_id = ANY($1::uuid[])
      )`, [estimateIdList]);
      await client.query(`DELETE FROM estimate_revisions WHERE estimate_id = ANY($1::uuid[])`, [estimateIdList]);
      await client.query(`DELETE FROM estimates WHERE id = ANY($1::uuid[])`, [estimateIdList]);
    }

    await client.query(`DELETE FROM user_invites WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM builder_invitations WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM boq_revisions WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM project_revisions WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM audit_logs WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM boqs WHERE project_id = $1`, [projectId]);

    const result = await client.query(`DELETE FROM projects WHERE id = $1 RETURNING id`, [projectId]);
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Project not found" });
    }

    await client.query("COMMIT");

    await Promise.all(
      boqFiles.rows.map(async (row) => {
        if (!row.file_path) return;
        try {
          await unlink(row.file_path);
        } catch {
          return;
        }
      })
    );

    await logAdminAction(req, "admin.projects.delete", {
      projectId,
      impact: impact.rows[0],
    });

    return res.json({ success: true, impact: impact.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to delete project", error);
    return res.status(500).json({ error: "Failed to delete project" });
  } finally {
    client.release();
  }
});

router.get("/boqs", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);

    const totalQuery = await pool.query(`SELECT COUNT(*)::int AS count FROM boqs`);
    const rows = await pool.query(
      `SELECT b.id, b.project_id, p.name AS project_name, b.uploaded_by, uploader.email AS uploaded_by_email,
              b.file_name, b.file_type, b.file_size, b.created_at,
              CASE WHEN b.parsed_data IS NOT NULL THEN 'parsed' ELSE 'pending' END AS parsed_status
       FROM boqs b
       LEFT JOIN projects p ON p.id = b.project_id
       LEFT JOIN users uploader ON uploader.id = b.uploaded_by
       ORDER BY b.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return res.json({
      items: rows.rows,
      pagination: { page, pageSize, total: totalQuery.rows[0]?.count || 0 },
    });
  } catch (error) {
    console.error("Failed to list BOQs", error);
    return res.status(500).json({ error: "Failed to list BOQs" });
  }
});

router.delete("/boqs/:boqId", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const boqId = String(req.params.boqId || "");
    const boqRow = await client.query(
      `SELECT id, file_path, file_name, project_id FROM boqs WHERE id = $1`,
      [boqId]
    );
    if (!boqRow.rows.length) {
      return res.status(404).json({ error: "BOQ not found" });
    }
    const { file_path, file_name, project_id } = boqRow.rows[0];

    await client.query("BEGIN");
    await client.query(`UPDATE projects SET boq_id = NULL WHERE boq_id = $1`, [boqId]);
    await client.query(`DELETE FROM boqs WHERE id = $1`, [boqId]);
    await client.query("COMMIT");

    try { await unlink(file_path); } catch { /* file already gone or path invalid */ }

    await logAdminAction(req, "admin.boqs.delete", { boqId, fileName: file_name, projectId: project_id });
    return res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to delete BOQ", error);
    return res.status(500).json({ error: "Failed to delete BOQ" });
  } finally {
    client.release();
  }
});

router.get("/rate-templates", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);

    const totalQuery = await pool.query(`SELECT COUNT(*)::int AS count FROM rate_templates WHERE is_active = true`);
    const rows = await pool.query(
      `SELECT rt.id, rt.code, rt.name, rt.category, rt.sub_category, rt.unit,
              rt.overhead_percent, rt.profit_percent, rt.gst_percent,
              rt.approval_status, rt.submitted_for_global, rt.is_system,
              rt.created_at, rt.updated_at,
              rt.owner_organization_id,
              o.name AS organization_name,
              u.email AS created_by_email,
              COUNT(tli.id) AS line_item_count
       FROM rate_templates rt
       LEFT JOIN organizations o ON o.id = rt.owner_organization_id
       LEFT JOIN users u ON u.id = rt.created_by
       LEFT JOIN template_line_items tli ON tli.template_id = rt.id
       WHERE rt.is_active = true
       GROUP BY rt.id, o.name, u.email
       ORDER BY rt.code ASC, rt.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return res.json({
      items: rows.rows,
      pagination: { page, pageSize, total: totalQuery.rows[0]?.count || 0 },
    });
  } catch (error) {
    console.error("Failed to list rate templates", error);
    return res.status(500).json({ error: "Failed to list rate templates" });
  }
});

router.patch("/rate-templates/:templateId", async (req: Request, res: Response) => {
  try {
    const templateId = String(req.params.templateId || "").trim();
    if (!templateId) {
      return res.status(400).json({ error: "Template ID is required" });
    }

    const exists = await pool.query(
      `SELECT id FROM rate_templates WHERE id = $1 AND is_active = true LIMIT 1`,
      [templateId]
    );

    if (!exists.rows.length) {
      return res.status(404).json({ error: "Rate template not found" });
    }

    const {
      code,
      name,
      category,
      sub_category,
      unit,
      overhead_percent,
      profit_percent,
      gst_percent,
    } = req.body || {};

    const updates: string[] = [];
    const params: Array<string | number | null> = [];

    if (code !== undefined) {
      params.push(String(code).trim());
      updates.push(`code = $${params.length}`);
    }

    if (name !== undefined) {
      params.push(String(name).trim());
      updates.push(`name = $${params.length}`);
    }

    if (category !== undefined) {
      params.push(String(category).trim());
      updates.push(`category = $${params.length}`);
    }

    if (sub_category !== undefined) {
      params.push(String(sub_category).trim() || null);
      updates.push(`sub_category = $${params.length}`);
    }

    if (unit !== undefined) {
      params.push(String(unit).trim());
      updates.push(`unit = $${params.length}`);
    }

    if (overhead_percent !== undefined) {
      const parsed = Number(overhead_percent);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ error: "Invalid overhead_percent" });
      }
      params.push(parsed);
      updates.push(`overhead_percent = $${params.length}`);
    }

    if (profit_percent !== undefined) {
      const parsed = Number(profit_percent);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ error: "Invalid profit_percent" });
      }
      params.push(parsed);
      updates.push(`profit_percent = $${params.length}`);
    }

    if (gst_percent !== undefined) {
      const parsed = Number(gst_percent);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ error: "Invalid gst_percent" });
      }
      params.push(parsed);
      updates.push(`gst_percent = $${params.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No fields provided" });
    }

    params.push(templateId);
    await pool.query(
      `UPDATE rate_templates
       SET ${updates.join(", ")}, updated_at = NOW()
       WHERE id = $${params.length}`,
      params
    );

    await logAdminAction(req, "admin.rate-templates.update", {
      templateId,
      updatedFields: Object.keys(req.body || {}),
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to update rate template", error);
    return res.status(500).json({ error: "Failed to update rate template" });
  }
});

router.get("/template-approval-requests", async (_req: Request, res: Response) => {
  try {
    const rows = await pool.query(
      `SELECT rt.id, rt.code, rt.name, rt.category, rt.sub_category, rt.unit,
              rt.overhead_percent, rt.profit_percent, rt.gst_percent,
              rt.approval_status, rt.submitted_for_global, rt.created_at,
              rt.owner_organization_id,
              o.name AS organization_name,
              u.email AS created_by_email,
              tli.id AS line_item_id,
              tli.resource_id,
              tli.coefficient,
              tli.wastage_percent,
              tli.remarks,
              r.name AS resource_name,
              r.unique_code AS resource_code
       FROM rate_templates rt
       LEFT JOIN organizations o ON o.id = rt.owner_organization_id
       LEFT JOIN users u ON u.id = rt.created_by
       LEFT JOIN LATERAL (
         SELECT *
         FROM template_line_items
         WHERE template_id = rt.id
         ORDER BY sort_order ASC, created_at ASC
         LIMIT 1
       ) tli ON true
       LEFT JOIN resources r ON r.id = tli.resource_id
       WHERE rt.is_active = true
         AND rt.owner_organization_id IS NOT NULL
         AND rt.submitted_for_global = true
         AND rt.approval_status = 'pending'
       ORDER BY rt.created_at DESC`
    );

    return res.json(rows.rows);
  } catch (error) {
    console.error("Failed to list template approval requests", error);
    return res.status(500).json({ error: "Failed to list template approval requests" });
  }
});

router.patch("/template-approval-requests/:templateId", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const templateId = String(req.params.templateId || "");
    const {
      name,
      category,
      sub_category,
      unit,
      overhead_percent,
      profit_percent,
      gst_percent,
      resource_id,
      coefficient,
      wastage_percent,
      remarks,
    } = req.body || {};

    await client.query("BEGIN");

    const check = await client.query(
      `SELECT id FROM rate_templates
       WHERE id = $1
         AND is_active = true
         AND owner_organization_id IS NOT NULL
         AND submitted_for_global = true
         AND approval_status = 'pending'
       LIMIT 1`,
      [templateId]
    );

    if (!check.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pending template request not found" });
    }

    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined) {
      params.push(String(name).trim());
      updates.push(`name = $${params.length}`);
    }
    if (category !== undefined) {
      params.push(String(category).trim());
      updates.push(`category = $${params.length}`);
    }
    if (sub_category !== undefined) {
      params.push(String(sub_category).trim() || null);
      updates.push(`sub_category = $${params.length}`);
    }
    if (unit !== undefined) {
      params.push(String(unit).trim());
      updates.push(`unit = $${params.length}`);
    }
    if (overhead_percent !== undefined) {
      params.push(Number(overhead_percent));
      updates.push(`overhead_percent = $${params.length}`);
    }
    if (profit_percent !== undefined) {
      params.push(Number(profit_percent));
      updates.push(`profit_percent = $${params.length}`);
    }
    if (gst_percent !== undefined) {
      params.push(Number(gst_percent));
      updates.push(`gst_percent = $${params.length}`);
    }

    if (updates.length) {
      params.push(templateId);
      await client.query(
        `UPDATE rate_templates SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${params.length}`,
        params
      );
    }

    const lineItem = await client.query(
      `SELECT id FROM template_line_items WHERE template_id = $1 ORDER BY sort_order ASC, created_at ASC LIMIT 1`,
      [templateId]
    );

    if (lineItem.rows.length) {
      const lineUpdates: string[] = [];
      const lineParams: any[] = [];
      if (resource_id !== undefined) {
        lineParams.push(String(resource_id).trim() || null);
        lineUpdates.push(`resource_id = $${lineParams.length}`);
      }
      if (coefficient !== undefined) {
        lineParams.push(Number(coefficient));
        lineUpdates.push(`coefficient = $${lineParams.length}`);
      }
      if (wastage_percent !== undefined) {
        lineParams.push(Number(wastage_percent));
        lineUpdates.push(`wastage_percent = $${lineParams.length}`);
      }
      if (remarks !== undefined) {
        lineParams.push(String(remarks).trim() || null);
        lineUpdates.push(`remarks = $${lineParams.length}`);
      }

      if (lineUpdates.length) {
        lineParams.push(lineItem.rows[0].id);
        await client.query(
          `UPDATE template_line_items SET ${lineUpdates.join(", ")} WHERE id = $${lineParams.length}`,
          lineParams
        );
      }
    }

    await client.query("COMMIT");
    await logAdminAction(req, "admin.template-approval-requests.edit", {
      templateId,
      updatedFields: Object.keys(req.body || {}),
    });

    return res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to edit template approval request", error);
    return res.status(500).json({ error: "Failed to edit template approval request" });
  } finally {
    client.release();
  }
});

router.post("/template-approval-requests/:templateId/approve", async (req: Request, res: Response) => {
  try {
    const templateId = String(req.params.templateId || "");
    const adminUserId = getAdminUserId(req);

    const result = await pool.query(
      `UPDATE rate_templates
       SET owner_organization_id = NULL,
           approval_status = 'approved',
           submitted_for_global = false,
           approved_by = $2,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND is_active = true
         AND owner_organization_id IS NOT NULL
         AND approval_status = 'pending'
       RETURNING id, code, name`,
      [templateId, adminUserId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Pending template request not found" });
    }

    await logAdminAction(req, "admin.template-approval-requests.approve", {
      templateId,
      templateCode: result.rows[0].code,
      templateName: result.rows[0].name,
    });

    return res.json({ success: true, template: result.rows[0] });
  } catch (error) {
    console.error("Failed to approve template request", error);
    return res.status(500).json({ error: "Failed to approve template request" });
  }
});

router.get("/estimation-projects", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);

    const totalQuery = await pool.query(`SELECT COUNT(*)::int AS count FROM boq_projects`);
    const rows = await pool.query(
      `SELECT bp.id, bp.name, bp.status, bp.terrain, bp.project_type, bp.created_at,
              u.email AS user_email,
              (SELECT COUNT(*)::int FROM boq_items bi WHERE bi.project_id = bp.id) AS item_count,
              (SELECT COALESCE(SUM(bi.computed_amount), 0) FROM boq_items bi WHERE bi.project_id = bp.id) AS total_amount
       FROM boq_projects bp
       LEFT JOIN users u ON u.id = bp.user_id
       ORDER BY bp.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return res.json({
      items: rows.rows,
      pagination: { page, pageSize, total: totalQuery.rows[0]?.count || 0 },
    });
  } catch (error) {
    console.error("Failed to list estimation projects", error);
    return res.status(500).json({ error: "Failed to list estimation projects" });
  }
});

router.patch("/estimation-projects/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.projectId || "");
    const { name, description, status, terrain } = req.body || {};

    const updates: string[] = [];
    const params: Array<string> = [];

    if (name !== undefined) {
      params.push(String(name).trim());
      updates.push(`name = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(String(description).trim());
      updates.push(`description = $${params.length}`);
    }
    if (status !== undefined) {
      const allowed = ["draft", "in_progress", "WIP", "completed", "submitted", "estimated"];
      const normalizedStatus = String(status) === "WIP" ? "in_progress" : String(status);
      if (!allowed.includes(String(status))) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(", ")}` });
      }
      params.push(normalizedStatus);
      updates.push(`status = $${params.length}`);
    }
    if (terrain !== undefined) {
      params.push(String(terrain).trim());
      updates.push(`terrain = $${params.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: "No fields provided" });

    params.push(projectId);
    const result = await pool.query(
      `UPDATE boq_projects SET ${updates.join(", ")} WHERE id = $${params.length} RETURNING id, name, status`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ error: "Estimation project not found" });

    await logAdminAction(req, "admin.estimation-projects.update", {
      projectId,
      updatedFields: Object.keys(req.body || {}),
    });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update estimation project", error);
    return res.status(500).json({ error: "Failed to update estimation project" });
  }
});

router.delete("/estimation-projects/:projectId", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const projectId = String(req.params.projectId || "");
    const check = await client.query(`SELECT id, name FROM boq_projects WHERE id = $1`, [projectId]);
    if (!check.rows.length) return res.status(404).json({ error: "Estimation project not found" });

    const { name } = check.rows[0];
    await client.query("BEGIN");
    await client.query(`DELETE FROM rate_computations WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM boq_items WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM boq_sections WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM boq_projects WHERE id = $1`, [projectId]);
    await client.query("COMMIT");

    await logAdminAction(req, "admin.estimation-projects.delete", { projectId, name });
    return res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to delete estimation project", error);
    return res.status(500).json({ error: "Failed to delete estimation project" });
  } finally {
    client.release();
  }
});

router.get("/estimates", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);

    const totalQuery = await pool.query(`SELECT COUNT(*)::int AS count FROM estimates`);
    const rows = await pool.query(
      `SELECT e.id, e.project_id, p.name AS project_name, e.builder_org_id,
              o.name AS builder_org_name, e.status, e.created_at,
              (SELECT COUNT(*)::int FROM estimate_revisions er WHERE er.estimate_id = e.id) AS revision_count,
              (SELECT er.grand_total FROM estimate_revisions er WHERE er.estimate_id = e.id ORDER BY er.revision_number DESC LIMIT 1) AS grand_total,
              (SELECT er.submitted_at FROM estimate_revisions er WHERE er.estimate_id = e.id ORDER BY er.revision_number DESC LIMIT 1) AS submitted_at
       FROM estimates e
       LEFT JOIN projects p ON p.id = e.project_id
       LEFT JOIN organizations o ON o.id = e.builder_org_id
       ORDER BY e.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return res.json({
      items: rows.rows,
      pagination: { page, pageSize, total: totalQuery.rows[0]?.count || 0 },
    });
  } catch (error) {
    console.error("Failed to list estimates", error);
    return res.status(500).json({ error: "Failed to list estimates" });
  }
});

router.patch("/estimates/:estimateId", async (req: Request, res: Response) => {
  try {
    const estimateId = String(req.params.estimateId || "");
    const { status } = req.body || {};

    if (!status) return res.status(400).json({ error: "status is required" });
    const allowed = ["draft", "submitted", "awarded", "rejected"];
    if (!allowed.includes(String(status))) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(", ")}` });
    }

    const result = await pool.query(
      `UPDATE estimates SET status = $1 WHERE id = $2 RETURNING id, project_id, status`,
      [status, estimateId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Estimate not found" });

    await logAdminAction(req, "admin.estimates.update", { estimateId, status });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update estimate", error);
    return res.status(500).json({ error: "Failed to update estimate" });
  }
});

router.delete("/estimates/:estimateId", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const estimateId = String(req.params.estimateId || "");
    const check = await client.query(`SELECT id, project_id FROM estimates WHERE id = $1`, [estimateId]);
    if (!check.rows.length) return res.status(404).json({ error: "Estimate not found" });

    await client.query("BEGIN");
    const revIds = await client.query(
      `SELECT id FROM estimate_revisions WHERE estimate_id = $1`,
      [estimateId]
    );
    const revIdList = revIds.rows.map((r: { id: string }) => r.id);
    if (revIdList.length) {
      await client.query(`DELETE FROM awards WHERE estimate_revision_id = ANY($1::uuid[])`, [revIdList]);
    }
    await client.query(`DELETE FROM estimate_revisions WHERE estimate_id = $1`, [estimateId]);
    await client.query(`DELETE FROM estimates WHERE id = $1`, [estimateId]);
    await client.query("COMMIT");

    await logAdminAction(req, "admin.estimates.delete", { estimateId });
    return res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to delete estimate", error);
    return res.status(500).json({ error: "Failed to delete estimate" });
  } finally {
    client.release();
  }
});

router.get("/invites", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);

    const totalQuery = await pool.query(`SELECT COUNT(*)::int AS count FROM user_invites`);
    const rows = await pool.query(
      `SELECT ui.id, ui.email, ui.role, ui.project_id, p.name AS project_name,
              ui.organization_id, o.name AS organization_name,
              ui.created_at, ui.expires_at, ui.accepted_at,
              CASE
                WHEN ui.accepted_at IS NOT NULL THEN 'accepted'
                WHEN ui.expires_at < now() THEN 'expired'
                ELSE 'open'
              END AS status
       FROM user_invites ui
       LEFT JOIN projects p ON p.id = ui.project_id
       LEFT JOIN organizations o ON o.id = ui.organization_id
       ORDER BY ui.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return res.json({
      items: rows.rows,
      pagination: { page, pageSize, total: totalQuery.rows[0]?.count || 0 },
    });
  } catch (error) {
    console.error("Failed to list invites", error);
    return res.status(500).json({ error: "Failed to list invites" });
  }
});

router.post("/invites/:inviteId/resend", async (req: Request, res: Response) => {
  try {
    const inviteId = String(req.params.inviteId || "");
    const token = crypto.randomBytes(24).toString("hex");
    const result = await pool.query(
      `UPDATE user_invites
       SET token = $1,
           expires_at = now() + interval '7 days',
           accepted_at = NULL
       WHERE id = $2
       RETURNING id, email, role, token, expires_at`,
      [token, inviteId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Invite not found" });
    }

    const invite = result.rows[0];
    const inviteLink = buildInviteLink(invite.token);

    await logAdminAction(req, "admin.invites.resend", {
      inviteId,
      email: invite.email,
    });

    return res.json({
      success: true,
      inviteLink,
      expiresAt: invite.expires_at,
    });
  } catch (error) {
    console.error("Failed to resend invite", error);
    return res.status(500).json({ error: "Failed to resend invite" });
  }
});

router.delete("/invites/:inviteId", async (req: Request, res: Response) => {
  try {
    const inviteId = String(req.params.inviteId || "");
    const result = await pool.query(`DELETE FROM user_invites WHERE id = $1 RETURNING id, email`, [inviteId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Invite not found" });
    }

    await logAdminAction(req, "admin.invites.delete", {
      inviteId,
      email: result.rows[0].email,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete invite", error);
    return res.status(500).json({ error: "Failed to delete invite" });
  }
});

router.get("/dealers", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);

    const totalQuery = await pool.query(`SELECT COUNT(*)::int AS count FROM dealers`);
    const rows = await pool.query(
      `SELECT d.id, d.shop_name, d.email, d.city, d.state, d.is_approved, d.approval_date,
              d.created_at, d.user_id,
              (SELECT COUNT(*)::int FROM dealer_prices dp WHERE dp.dealer_id = d.id AND dp.is_active = true) AS price_count
       FROM dealers d
       ORDER BY d.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return res.json({
      items: rows.rows,
      pagination: { page, pageSize, total: totalQuery.rows[0]?.count || 0 },
    });
  } catch (error) {
    console.error("Failed to list dealers", error);
    return res.status(500).json({ error: "Failed to list dealers" });
  }
});

router.patch("/dealers/:dealerId/approval", async (req: Request, res: Response) => {
  try {
    const { dealerId } = req.params;
    const isApproved = Boolean(req.body?.isApproved);
    const adminUserId = getAdminUserId(req);

    const result = await pool.query(
      `UPDATE dealers
       SET is_approved = $1,
           approval_date = CASE WHEN $1 THEN now() ELSE NULL END,
           approved_by = CASE WHEN $1 THEN $2 ELSE NULL END
       WHERE id = $3
       RETURNING id, shop_name, is_approved, approval_date, approved_by`,
      [isApproved, adminUserId, dealerId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Dealer not found" });
    }

    await logAdminAction(req, "admin.dealers.approval", { dealerId, isApproved });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update dealer approval", error);
    return res.status(500).json({ error: "Failed to update dealer approval" });
  }
});

router.get("/prices/records", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);

    const totalQuery = await pool.query(`SELECT COUNT(*)::int AS count FROM price_records`);
    const rows = await pool.query(
      `SELECT pr.id, pr.material_id, pr.district_id, pr.price, pr.brand_name, pr.source, pr.scraped_at, pr.flagged, pr.created_at,
              m.name AS material_name, m.unit AS material_unit,
              d.name AS district_name
       FROM price_records pr
       JOIN materials m ON m.id = pr.material_id
       JOIN districts d ON d.id = pr.district_id
       ORDER BY pr.scraped_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return res.json({
      items: rows.rows,
      pagination: { page, pageSize, total: totalQuery.rows[0]?.count || 0 },
    });
  } catch (error) {
    console.error("Failed to list price records", error);
    return res.status(500).json({ error: "Failed to list price records" });
  }
});

router.get("/prices/reference", async (_req: Request, res: Response) => {
  try {
    const [materials, districts] = await Promise.all([
      pool.query(`SELECT id, name, unit FROM materials ORDER BY name ASC`),
      pool.query(`SELECT id, name, region FROM districts ORDER BY name ASC`),
    ]);

    return res.json({
      materials: materials.rows,
      districts: districts.rows,
    });
  } catch (error) {
    console.error("Failed to load price references", error);
    return res.status(500).json({ error: "Failed to load price references" });
  }
});

router.post("/prices/records", async (req: Request, res: Response) => {
  try {
    const { materialId, districtId, price, brandName, source, scrapedAt, flagged } = req.body || {};
    if (!materialId || !districtId || !price || !source) {
      return res.status(400).json({ error: "materialId, districtId, price and source are required" });
    }

    const result = await pool.query(
      `INSERT INTO price_records (material_id, district_id, price, brand_name, source, scraped_at, flagged)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, material_id, district_id, price, brand_name, source, scraped_at, flagged, created_at`,
      [
        materialId,
        districtId,
        Number(price),
        brandName ? String(brandName).trim() : null,
        String(source).trim(),
        scrapedAt || new Date().toISOString(),
        Boolean(flagged),
      ]
    );

    await logAdminAction(req, "admin.prices.create", {
      priceRecordId: result.rows[0].id,
      materialId,
      districtId,
    });

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Failed to create price record", error);
    return res.status(500).json({ error: "Failed to create price record" });
  }
});

router.patch("/prices/records/:recordId", async (req: Request, res: Response) => {
  try {
    const recordId = String(req.params.recordId || "");
    const { materialId, districtId, price, brandName, source, scrapedAt, flagged } = req.body || {};

    const updates: string[] = [];
    const params: Array<string | number | boolean | null> = [];

    if (materialId !== undefined) {
      params.push(String(materialId));
      updates.push(`material_id = $${params.length}`);
    }

    if (districtId !== undefined) {
      params.push(String(districtId));
      updates.push(`district_id = $${params.length}`);
    }

    if (price !== undefined) {
      params.push(Number(price));
      updates.push(`price = $${params.length}`);
    }

    if (brandName !== undefined) {
      params.push(brandName ? String(brandName).trim() : null);
      updates.push(`brand_name = $${params.length}`);
    }

    if (source !== undefined) {
      params.push(String(source).trim());
      updates.push(`source = $${params.length}`);
    }

    if (scrapedAt !== undefined) {
      params.push(String(scrapedAt));
      updates.push(`scraped_at = $${params.length}`);
    }

    if (flagged !== undefined) {
      params.push(Boolean(flagged));
      updates.push(`flagged = $${params.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No fields provided" });
    }

    params.push(recordId);

    const result = await pool.query(
      `UPDATE price_records
       SET ${updates.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, material_id, district_id, price, brand_name, source, scraped_at, flagged, created_at`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Price record not found" });
    }

    await logAdminAction(req, "admin.prices.update", {
      priceRecordId: recordId,
      updatedFields: Object.keys(req.body || {}),
    });

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update price record", error);
    return res.status(500).json({ error: "Failed to update price record" });
  }
});

router.delete("/prices/records/:recordId", async (req: Request, res: Response) => {
  try {
    const recordId = String(req.params.recordId || "");
    const result = await pool.query(`DELETE FROM price_records WHERE id = $1 RETURNING id`, [recordId]);
    if (!result.rows.length) {
      return res.status(404).json({ error: "Price record not found" });
    }

    await logAdminAction(req, "admin.prices.delete", { priceRecordId: recordId });
    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete price record", error);
    return res.status(500).json({ error: "Failed to delete price record" });
  }
});

router.get("/prices/alerts", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);

    const totalQuery = await pool.query(`SELECT COUNT(*)::int AS count FROM price_alerts`);
    const rows = await pool.query(
      `SELECT pa.id, pa.condition, pa.threshold, pa.is_active, pa.last_triggered_at, pa.created_at,
              u.email AS user_email, m.name AS material_name, d.name AS district_name
       FROM price_alerts pa
       JOIN users u ON u.id = pa.user_id
       JOIN materials m ON m.id = pa.material_id
       JOIN districts d ON d.id = pa.district_id
       ORDER BY pa.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return res.json({
      items: rows.rows,
      pagination: { page, pageSize, total: totalQuery.rows[0]?.count || 0 },
    });
  } catch (error) {
    console.error("Failed to list price alerts", error);
    return res.status(500).json({ error: "Failed to list price alerts" });
  }
});

router.get("/audit", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePagination(req);

    const totalQuery = await pool.query(`SELECT COUNT(*)::int AS count FROM audit_logs`);
    const rows = await pool.query(
      `SELECT al.id, al.project_id, al.user_id, u.email AS user_email,
              al.action, al.metadata, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return res.json({
      items: rows.rows,
      pagination: { page, pageSize, total: totalQuery.rows[0]?.count || 0 },
    });
  } catch (error) {
    console.error("Failed to list audit logs", error);
    return res.status(500).json({ error: "Failed to list audit logs" });
  }
});

router.post("/scrapers/run", async (req: Request, res: Response) => {
  try {
    const sourceQuery = String(req.query.source || "all").toLowerCase();
    const source =
      sourceQuery === "indiamart" || sourceQuery === "pwd" || sourceQuery === "aggregator"
        ? sourceQuery
        : undefined;

    const result = await runScrapers(source);
    await logAdminAction(req, "admin.scrapers.run", { source: source || "all", result });
    return res.json(result);
  } catch (error) {
    console.error("Manual scraper run failed", error);
    return res.status(500).json({ error: "Failed to run scrapers" });
  }
});

router.post("/scrapers/run-labour", async (req: Request, res: Response) => {
  try {
    const result = await runLabourScraper();
    await logAdminAction(req, "admin.scrapers.run-labour", { result });
    return res.json(result);
  } catch (error) {
    console.error("Manual labour scraper run failed", error);
    return res.status(500).json({ error: "Failed to run labour scraper" });
  }
});

export default router;
router.post("/scrapers/run-all-materials", async (req: Request, res: Response) => {
  try {
    const result = await runAllMaterialsScraper();
    await logAdminAction(req, "admin.scrapers.run-all-materials", { result });
    return res.json(result);
  } catch (error) {
    console.error("Manual all-materials scraper run failed", error);
    return res.status(500).json({ error: "Failed to run all-materials scraper" });
  }
});


