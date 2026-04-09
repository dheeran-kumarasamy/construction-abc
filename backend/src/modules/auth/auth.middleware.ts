import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // Allow preflight OPTIONS requests without authentication
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: string;
      organizationId?: string | null;
      orgRole?: "head" | "member" | null;
      adminRole?: "super_admin" | "admin_team" | null;
    };

    (req as any).user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || String(user.role || "").toLowerCase() !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  return next();
}

/** Only super_admin users may pass. admin_team users get 403. */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || String(user.role || "").toLowerCase() !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  // Treat missing adminRole as super_admin for backward compatibility with
  // tokens issued before migration 024.
  const adminRole = String(user.adminRole || "super_admin");
  if (adminRole !== "super_admin") {
    return res.status(403).json({ error: "Super admin access required" });
  }

  return next();
}