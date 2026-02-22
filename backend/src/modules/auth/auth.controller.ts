import { Request, Response } from "express";
import * as service from "./auth.service";

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

    if (err?.message === "Invalid credentials" || err?.message === "User not activated") {
      return res.status(401).json({ error: err.message });
    }

    return res.status(400).json({ error: err.message || "Login failed" });
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
    const orgId = (req as any).user?.organizationId || null;

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    if (!orgId) {
      return res.status(403).json({ error: "Missing organization context" });
    }

    // projectId can be required for project-scoped invites
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required for project invites" });
    }

    const result = await service.createInvite(email, role, orgId, projectId);

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getInvites(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.organizationId || null;

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
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}