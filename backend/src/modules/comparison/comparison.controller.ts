import { Request, Response } from "express";
import * as service from "./comparison.service";

export async function getProjectComparison(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;

    const result = await service.fetchComparison(projectIdStr);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function awardProject(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
    const { estimateRevisionId } = req.body || {};
    const userId = (req as any).user?.userId || null;

    if (!estimateRevisionId) {
      return res.status(400).json({ error: "estimateRevisionId is required" });
    }

    const result = await service.createAward(projectIdStr, estimateRevisionId, userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}