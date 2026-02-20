import { Request, Response } from "express";
import * as service from "./boq.service";
import path from "path";

export async function parseBOQ(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const result = await service.parseBOQFile(req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function checkBOQ(req: Request, res: Response) {
  try {
    let { projectId } = req.params;
    if (Array.isArray(projectId)) {
      projectId = projectId[0];
    }

    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    const boq = await service.checkExistingBOQ(projectId);
    res.json({ existing: !!boq, boq });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

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

    let columnMapping: Record<string, string> | undefined;
    const rawMapping = req.body.columnMapping ?? req.body.mapping;
    if (rawMapping) {
      try {
        const parsed = typeof rawMapping === "string" ? JSON.parse(rawMapping) : rawMapping;
        if (parsed && typeof parsed === "object") {
          columnMapping = parsed as Record<string, string>;
        }
      } catch {
        columnMapping = undefined;
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

    let items: any[] = [];
    try {
      if (result.file_path && result.column_mapping) {
        const mapping = typeof result.column_mapping === 'string' 
          ? JSON.parse(result.column_mapping) 
          : result.column_mapping;
        const parsed = await service.parseStoredBOQFile(result.file_path, mapping);
        items = parsed.items || [];
      }
    } catch (parseErr) {
      console.error("Error parsing BOQ file:", parseErr);
      items = [];
    }

    res.json({
      ...result,
      items,
    });
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
