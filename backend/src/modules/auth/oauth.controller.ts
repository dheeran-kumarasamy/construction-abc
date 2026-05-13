import { Request, Response } from "express";
import * as oauthService from "./oauth.service";

export async function googleOAuthCallback(req: Request, res: Response) {
  try {
    const { profile, role } = req.body;

    if (!profile || !role) {
      return res.status(400).json({ error: "profile and role are required" });
    }

    if (!["architect", "builder", "dealer"].includes(role)) {
      return res.status(400).json({ error: "role must be architect, builder, or dealer" });
    }

    const result = await oauthService.handleGoogleOAuthCallback(profile, role);

    res.json(result);
  } catch (err: any) {
    console.error("Google OAuth callback error:", err.message);
    return res.status(400).json({ error: err.message || "OAuth callback failed" });
  }
}

export async function validateToken(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.slice(7);
    const decoded = oauthService.verifyToken(token);

    res.json({ valid: true, decoded });
  } catch (err: any) {
    return res.status(401).json({ error: err.message || "Invalid token" });
  }
}
