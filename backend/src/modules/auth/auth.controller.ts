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
    console.log("BODY RECEIVED:", req.body); // ← ADD THIS

  try {
    const { email, role, organizationId } = req.body || {};

    if (!email || !role || !organizationId) {
      return res.status(400).json({
        error: "email, role, and organizationId are required",
      });
    }

    const result = await service.createInvite(email, role, organizationId);

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}