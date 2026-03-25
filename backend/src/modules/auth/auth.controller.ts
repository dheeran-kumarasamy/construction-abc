import { Request, Response } from "express";
import * as service from "./auth.service";
import { pool } from "../../config/db";

async function resolveOrganizationId(req: Request): Promise<string | null> {
  const tokenOrgId = (req as any).user?.organizationId;
  if (tokenOrgId) {
    return tokenOrgId;
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return null;
  }

  const { rows } = await pool.query(
    `SELECT organization_id FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );

  const resolvedOrgId = rows[0]?.organization_id;
  return resolvedOrgId || null;
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await service.loginUser(email, password);

    res.json(result);
  } catch (err: any) {
    console.error("Login error:", { email: req.body?.email, error: err.message });
    if (err?.message === "Authentication service unavailable") {
      return res.status(503).json({ error: err.message });
    }

    if (err?.message === "Invalid credentials" || err?.message === "User not activated" || err?.message === "User account is disabled") {
      return res.status(401).json({ error: err.message });
    }

    return res.status(400).json({ error: err.message || "Login failed" });
  }
}

async function getRequesterProfile(req: Request) {
  const userId = (req as any).user?.userId;
  if (!userId) return null;

  const { rows } = await pool.query(
    `SELECT id, role, organization_id, org_role FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, role, organizationName, phoneNumber, dealerData } = req.body || {};

    const result = await service.registerUser({
      email,
      password,
      role,
      organizationName,
      phoneNumber,
      dealerData,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    const message = String(err?.message || "Registration failed");
    if (/builder self-registration is disabled/i.test(message)) {
      return res.status(403).json({ error: message });
    }
    if (/admin self-registration is disabled/i.test(message)) {
      return res.status(403).json({ error: message });
    }
    if (/already exists/i.test(message)) {
      return res.status(409).json({ error: message });
    }
    return res.status(400).json({ error: message });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { email, newPassword } = req.body || {};
    const result = await service.resetPassword(email, newPassword);
    return res.json(result);
  } catch (err: any) {
    const message = String(err?.message || "Password reset failed");
    if (/user not found/i.test(message)) {
      return res.status(404).json({ error: message });
    }
    return res.status(400).json({ error: message });
  }
}

export async function acceptInvite(req: Request, res: Response) {
  try {
    const { token, password } = req.body;

    const result = await service.acceptInvite(token, password);

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function inviteUser(req: Request, res: Response) {
  try {
    const { email, role = "builder", projectId } = req.body || {};
    const orgId = await resolveOrganizationId(req);
    const normalizedRole = String(role || "").trim().toLowerCase();
    const referer = req.headers.referer;
    const requester = await getRequesterProfile(req);

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    if (!orgId) {
      return res.status(403).json({ error: "Missing organization context" });
    }

    if (!requester || String(requester.role || "").toLowerCase() !== "architect") {
      return res.status(403).json({ error: "Only architect users can send invites" });
    }

    if (normalizedRole !== "builder" && normalizedRole !== "architect") {
      return res.status(400).json({ error: "Invite role must be either builder or architect" });
    }

    if (normalizedRole === "builder") {
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required for builder project invites" });
      }

      const projectAccess = await pool.query(
        `SELECT p.id
         FROM projects p
         JOIN users architect_user ON architect_user.id = p.architect_id
         WHERE p.id = $1
           AND architect_user.organization_id = $2
         LIMIT 1`,
        [projectId, orgId]
      );

      if (!projectAccess.rows.length) {
        return res.status(403).json({ error: "You can invite builders only for projects in your architect organization" });
      }

      const result = await service.createInvite(email, "builder", orgId, projectId, null, referer);
      return res.json(result);
    }

    if (String(requester.org_role || "").toLowerCase() !== "head") {
      return res.status(403).json({ error: "Only Architect Head can invite architect team members" });
    }

    // For architect invites, projectId is optional - allows assigning specific projects to team members
    if (projectId) {
      const projectAccess = await pool.query(
        `SELECT p.id
         FROM projects p
         JOIN users architect_user ON architect_user.id = p.architect_id
         WHERE p.id = $1
           AND architect_user.organization_id = $2
         LIMIT 1`,
        [projectId, orgId]
      );

      if (!projectAccess.rows.length) {
        return res.status(403).json({ error: "You can only assign projects from your architect organization" });
      }
    }

    const result = await service.createInvite(email, "architect", orgId, projectId || null, "member", referer);

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getInvites(req: Request, res: Response) {
  try {
    const orgId = await resolveOrganizationId(req);
    const referer = req.headers.referer;

    if (!orgId) {
      return res.status(403).json({ error: "Missing organization context" });
    }

    const roleRaw = req.query.role;
    const projectIdRaw = req.query.projectId;
    const statusRaw = req.query.status;

    const role = typeof roleRaw === "string" ? roleRaw : undefined;
    const projectId = typeof projectIdRaw === "string" ? projectIdRaw : undefined;
    const status = typeof statusRaw === "string" ? statusRaw : undefined;

    const result = await service.listInvites(orgId, {
      role: role || undefined,
      projectId: projectId || undefined,
      status:
        status === "open" || status === "accepted" || status === "expired"
          ? status
          : undefined,
      referer,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getMyProfile(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const profile = await service.getMyProfile(userId);
    return res.json(profile);
  } catch (err: any) {
    const message = String(err?.message || "Failed to fetch profile");
    if (/user not found/i.test(message)) {
      return res.status(404).json({ error: message });
    }
    return res.status(400).json({ error: message });
  }
}

export async function updateMyPhoneNumber(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const phoneNumber = String(req.body?.phoneNumber || "");
    const profile = await service.updateMyPhoneNumber(userId, phoneNumber);
    return res.json(profile);
  } catch (err: any) {
    const message = String(err?.message || "Failed to update phone number");
    if (/phoneNumber/i.test(message)) {
      return res.status(400).json({ error: message });
    }
    if (/user not found/i.test(message)) {
      return res.status(404).json({ error: message });
    }
    return res.status(400).json({ error: message });
  }
}