import { Request, Response } from "express";
import * as service from "./builder.service";

export async function getAvailableProjects(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const userId = user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const projects = await service.getAvailableProjects(userId);
    return res.json(projects);
  } catch (error) {
    console.error("Get available projects error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch projects",
    });
  }
}

export async function getProjectBOQItems(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
    const user = (req as any).user;
    const userId = user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const boqItems = await service.getProjectBOQItems(projectIdStr, userId);
    return res.json(boqItems);
  } catch (error) {
    console.error("Get BOQ items error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch BOQ items",
    });
  }
}

export async function getBuilderBasePricing(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const builderOrgId = user?.organizationId;

    if (!builderOrgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const pricing = await service.getBuilderBasePricing(builderOrgId);
    return res.json(pricing);
  } catch (error) {
    console.error("Get base pricing error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch base pricing",
    });
  }
}

export async function createOrUpdateEstimate(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
    const { pricedItems, marginConfig, notes } = req.body;

    const user = (req as any).user;
    const builderOrgId = user?.organizationId;
    const userId = user?.userId;

    if (!userId || !builderOrgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await service.createOrUpdateEstimate(
      projectIdStr,
      userId,
      builderOrgId,
      pricedItems,
      marginConfig,
      notes
    );

    return res.json(result);
  } catch (error) {
    console.error("Create estimate error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create estimate",
    });
  }
}

export async function getSubmittedEstimates(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const builderOrgId = user?.organizationId;

    if (!builderOrgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const estimates = await service.getSubmittedEstimates(builderOrgId);
    return res.json(estimates);
  } catch (error) {
    console.error("Get submitted estimates error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch submitted estimates",
    });
  }
}

export async function optimizeEstimateTarget(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
    const { targetTotal, pricedItems } = req.body as {
      targetTotal?: number;
      hardFail?: boolean;
      pricedItems?: Array<{
        id: number;
        item: string;
        qty: number;
        uom: string;
        rate: number;
        total: number;
        category?: string;
      }>;
      marginConfig?: {
        overallMargin?: number;
        laborUplift?: number;
        machineryUplift?: number;
      };
    };
    const marginConfig = req.body?.marginConfig;
    const hardFail = req.body?.hardFail;

    const user = (req as any).user;
    const userId = user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!Number.isFinite(targetTotal) || Number(targetTotal) <= 0) {
      return res.status(400).json({ error: "targetTotal must be a positive number" });
    }

    if (!Array.isArray(pricedItems) || pricedItems.length === 0) {
      return res.status(400).json({ error: "pricedItems are required" });
    }

    const result = await service.suggestTargetOptimizations(
      projectIdStr,
      userId,
      Number(targetTotal),
      pricedItems,
      marginConfig,
      Boolean(hardFail)
    );

    return res.json(result);
  } catch (error) {
    console.error("Optimize estimate target error:", error);
    const message = error instanceof Error ? error.message : "Failed to optimize target";

    if (/not invited|do not have access/i.test(message)) {
      return res.status(403).json({ error: message });
    }

    if (/hard fail enabled|missing_api_key|no valid optimization suggestions|missing llm suggestion/i.test(message)) {
      return res.status(422).json({ error: message, code: "LLM_OPTIMIZATION_UNAVAILABLE" });
    }

    if (/target total|priceditems|required|positive number/i.test(message)) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
}
