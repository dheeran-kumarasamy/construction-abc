import { Request, Response } from "express";
import { parseBasePricingFile, uploadBasePricing } from "./base-pricing.service";

export async function parseBasePricing(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const result = await parseBasePricingFile(filePath);

    return res.json(result);
  } catch (error) {
    console.error("Parse base pricing error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to parse file",
    });
  }
}

export async function uploadBasePricingFile(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const user = (req as any).user;
    if (!user?.organizationId) {
      return res.status(401).json({ error: "Organization not found" });
    }

    const filePath = req.file.path;
    const builderOrgId = user.organizationId;

    // Parse column mapping from request body
    let columnMapping;
    try {
      columnMapping =
        typeof req.body.columnMapping === "string"
          ? JSON.parse(req.body.columnMapping)
          : req.body.columnMapping;
    } catch (err) {
      return res.status(400).json({ error: "Invalid column mapping" });
    }

    const result = await uploadBasePricing(filePath, builderOrgId, columnMapping);

    return res.json(result);
  } catch (error) {
    console.error("Upload base pricing error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to upload file",
    });
  }
}
