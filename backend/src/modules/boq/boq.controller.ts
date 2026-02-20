import { Request, Response } from "express";
import * as service from "./boq.service";
import path from "path";

export async function uploadBOQ(req: Request, res: Response) {
  try {
    let { projectId } = req.params;
    const userId = (req as any).user?.userId;

    if (Array.isArray(projectId)) {
      projectId = projectId[0];
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate file type (PDF, Excel, CSV)
    const allowedTypes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ];

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: "Invalid file type. Only PDF, Excel, and CSV files are allowed",
      });
    }

    console.log("Params:", req.params);
    console.log("File:", req.file);
    console.log("Body:", req.body);

    const result = await service.uploadBOQ(projectId, userId, req.file);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getBOQ(req: Request, res: Response) {
  try {
    let { projectId } = req.params;
    if (Array.isArray(projectId)) {
      projectId = projectId[0];
    }
    const result = await service.getBOQByProject(projectId);

    if (!result) {
      return res.status(404).json({ error: "BOQ not found" });
    }

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function downloadBOQ(req: Request, res: Response) {
  try {
    let { projectId } = req.params;
    if (Array.isArray(projectId)) {
      projectId = projectId[0];
    }
    const boq = await service.getBOQByProject(projectId);

    if (!boq) {
      return res.status(404).json({ error: "BOQ not found" });
    }

    res.download(boq.file_path, boq.file_name);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteBOQ(req: Request, res: Response) {
  try {
    let { projectId } = req.params;
    if (Array.isArray(projectId)) {
      projectId = projectId[0];
    }
    const result = await service.deleteBOQ(projectId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
