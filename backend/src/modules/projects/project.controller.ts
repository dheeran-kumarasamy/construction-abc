import { Request, Response } from "express";
import * as service from "./project.service";

export async function createProject(req: Request, res: Response) {
  try {
    const { name, description, siteAddress, latitude, longitude, startDate, durationMonths, clientOrgId } = req.body || {};
    const authUser = (req as any).user || {};
    const userId = authUser.userId || authUser.id || authUser.sub || null;

    if (!name || !siteAddress || !startDate || !durationMonths) {
      return res.status(400).json({ error: "Missing required project fields" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await service.createProjectWithRevision({
      name,
      description,
      siteAddress,
      latitude,
      longitude,
      startDate,
      durationMonths,
      userId,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getProjects(req: Request, res: Response) {
  try {
    const authUser = (req as any).user || {};
    const userId = authUser.userId || authUser.id || authUser.sub || null;
    const result = await service.getProjects(userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}