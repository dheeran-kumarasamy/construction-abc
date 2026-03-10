import { Router, Request, Response } from "express";
import { authenticate } from "../auth/auth.middleware";
import { runScrapers } from "../../services/scrapers";

const router = Router();

function isAdminUser(req: Request) {
  const user = (req as any).user;
  if (!user) return false;

  if (user.role === "architect" && user.orgRole === "head") return true;
  return false;
}

router.post("/scrapers/run", authenticate, async (req: Request, res: Response) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Only admin users can run scrapers" });
    }

    const sourceQuery = String(req.query.source || "all").toLowerCase();
    const source =
      sourceQuery === "indiamart" || sourceQuery === "pwd" || sourceQuery === "aggregator"
        ? sourceQuery
        : undefined;

    const result = await runScrapers(source);
    return res.json(result);
  } catch (error) {
    console.error("Manual scraper run failed", error);
    return res.status(500).json({ error: "Failed to run scrapers" });
  }
});

export default router;
