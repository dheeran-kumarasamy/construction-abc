import { Request, Response } from "express";
import * as service from "./boq.service";

export async function uploadBoq(req: Request, res: Response) {
  try {
    const { projectId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "BOQ file is required" });
    }

    if (Array.isArray(projectId)) {
      return res.status(400).json({ error: "Invalid projectId" });
    }

    const result = await service.processBoqUpload({
      projectId,
      filePath: req.file.path,
      userId: (req as any).user?.userId || null,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
