import { Request, Response } from "express";
import * as service from "./project.service";

export async function createProject(req: Request, res: Response) {
  try {
    const { name, description, siteAddress, latitude, longitude, startDate, durationMonths, clientOrgId } = req.body || {};

    if (!name || !siteAddress || !startDate || !durationMonths) {
      return res.status(400).json({ error: "Missing required project fields" });
    }

    const result = await service.createProjectWithRevision({
      name,
      description,
      siteAddress,
      latitude,
      longitude,
      startDate,
      durationMonths,
      userId: (req as any).user?.userId || null,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getProjects(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId || null;
    const result = await service.getProjects(userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}