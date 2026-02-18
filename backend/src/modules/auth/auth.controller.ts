import { Request, Response } from "express";
import * as service from "./auth.service";

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    const result = await service.loginUser(email, password);

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
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