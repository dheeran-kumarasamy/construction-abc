// Parse BOQ file for preview (ignore rate)
export async function parseBOQ(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const result = await service.parseBOQFile(req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
import { Request, Response } from "express";
import * as service from "./boq.service";
import path from "path";

export async function uploadBOQ(req: Request, res: Response) {
  try {
    let { projectId } = req.params;
    const user = (req as any).user || {};
    const userId = user.userId || user.id || user.sub;

    if (Array.isArray(projectId)) {
      projectId = projectId[0];
    }

    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
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
      "application/octet-stream",
    ];

    const allowedExtensions = new Set([".pdf", ".csv", ".xls", ".xlsx"]);
    const fileExtension = path.extname(req.file.originalname || "").toLowerCase();

    const isAllowedType = allowedTypes.includes(req.file.mimetype);
    const isAllowedExtension = allowedExtensions.has(fileExtension);

    if (!isAllowedType && !isAllowedExtension) {
      return res.status(400).json({
        error: "Invalid file type. Only PDF, Excel, and CSV files are allowed",
      });
    }

    console.log("Params:", req.params);
    console.log("File:", req.file);
    console.log("Body:", req.body);

    // Parse column mapping from request body if provided
    let columnMapping;
    if (req.body.columnMapping) {
      try {
        columnMapping = typeof req.body.columnMapping === 'string' 
          ? JSON.parse(req.body.columnMapping) 
          : req.body.columnMapping;
      } catch (err) {
        return res.status(400).json({ error: "Invalid column mapping format" });
      }
    }

    const result = await service.uploadBOQ(projectId, userId, req.file, columnMapping);
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
