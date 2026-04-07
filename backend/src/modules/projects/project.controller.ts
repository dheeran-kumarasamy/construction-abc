import { Request, Response } from "express";
import * as service from "./project.service";

export async function createProject(req: Request, res: Response) {
  try {
    const {
      name,
      description,
      siteAddress,
      latitude,
      longitude,
      startDate,
      durationMonths,
      buildingType,
      floorsAboveGround,
      floorsBelowGround,
      clientOrgId,
    } = req.body || {};
    const authUser = (req as any).user || {};
    const userId = authUser.userId || authUser.id || authUser.sub || null;
    const allowedBuildingTypes = ["Residential", "Commercial", "Industrial", "Multistory"];

    const normalizedFloorsAboveGround = Number(floorsAboveGround);
    const normalizedFloorsBelowGround = Number(floorsBelowGround);
    const normalizedLatitude = Number(latitude);
    const normalizedLongitude = Number(longitude);

    if (!name || !siteAddress || !startDate || !durationMonths || !buildingType || latitude == null || longitude == null) {
      return res.status(400).json({ error: "Missing required project fields" });
    }

    if (!allowedBuildingTypes.includes(String(buildingType))) {
      return res.status(400).json({ error: "Invalid building type" });
    }

    if (!Number.isInteger(normalizedFloorsAboveGround) || normalizedFloorsAboveGround < 1) {
      return res.status(400).json({ error: "Floors above natural ground level must be at least 1" });
    }

    if (!Number.isInteger(normalizedFloorsBelowGround) || normalizedFloorsBelowGround < 0) {
      return res.status(400).json({ error: "Floors below natural ground level must be 0 or more" });
    }

    if (!Number.isFinite(normalizedLatitude) || !Number.isFinite(normalizedLongitude)) {
      return res.status(400).json({ error: "Valid latitude and longitude are required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await service.createProjectWithRevision({
      name,
      description,
      siteAddress,
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
      startDate,
      durationMonths,
      buildingType,
      floorsAboveGround: normalizedFloorsAboveGround,
      floorsBelowGround: normalizedFloorsBelowGround,
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