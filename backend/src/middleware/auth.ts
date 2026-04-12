import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // Allow preflight requests through CORS middleware
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
    (req as any).user = user;
    return next();
  });
}