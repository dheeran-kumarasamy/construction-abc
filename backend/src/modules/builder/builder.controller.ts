import { Request, Response } from "express";
import * as service from "./builder.service";
import { pool } from "../../config/db";

async function resolveBuilderOrganizationId(userId: string, projectId?: string): Promise<string | null> {
  const userOrg = await pool.query(
    `SELECT organization_id FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );

  const organizationId = userOrg.rows[0]?.organization_id;
  if (organizationId) {
    return organizationId;
  }

  if (projectId) {
    const inviteOrg = await pool.query(
      `SELECT organization_id
       FROM user_invites
       WHERE user_id = $1
         AND project_id = $2
         AND accepted_at IS NOT NULL
         AND organization_id IS NOT NULL
       ORDER BY accepted_at DESC
       LIMIT 1`,
      [userId, projectId]
    );

    if (inviteOrg.rows[0]?.organization_id) {
      return inviteOrg.rows[0].organization_id;
    }
  }

  const anyInviteOrg = await pool.query(
    `SELECT organization_id
     FROM user_invites
     WHERE user_id = $1
       AND accepted_at IS NOT NULL
       AND organization_id IS NOT NULL
     ORDER BY accepted_at DESC
     LIMIT 1`,
    [userId]
  );

  return anyInviteOrg.rows[0]?.organization_id || null;
}

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
    const userId = user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const builderOrgId = user?.organizationId || (await resolveBuilderOrganizationId(userId));

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
    const userId = user?.userId;
    const builderOrgId = user?.organizationId || (userId ? await resolveBuilderOrganizationId(userId, projectIdStr) : null);

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
    const userId = user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const builderOrgId = user?.organizationId || (await resolveBuilderOrganizationId(userId));

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

export async function getSubmittedEstimateHistory(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const userId = user?.userId;
    const { estimateId } = req.params;
    const estimateIdStr = Array.isArray(estimateId) ? estimateId[0] : estimateId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const builderOrgId = user?.organizationId || (await resolveBuilderOrganizationId(userId));

    if (!builderOrgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const history = await service.getBuilderEstimateHistory(builderOrgId, estimateIdStr);
    return res.json(history);
  } catch (error) {
    console.error("Get submitted estimate history error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch estimate history",
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
      selectedGuardrails?: string[];
      projectContext?: {
        siteAddress?: string;
        city?: string;
      };
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
    const selectedGuardrails = req.body?.selectedGuardrails;
    const projectContext = req.body?.projectContext;

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
      Boolean(hardFail),
      Array.isArray(selectedGuardrails) ? selectedGuardrails : [],
      projectContext
    );

    return res.json(result);
  } catch (error) {
    console.error("Optimize estimate target error:", error);
    const message = error instanceof Error ? error.message : "Failed to optimize target";

    if (/not invited|do not have access/i.test(message)) {
      return res.status(403).json({ error: message, code: "PROJECT_ACCESS_DENIED" });
    }

    if (/hard fail enabled|missing llm suggestion|no valid optimization suggestions|rate limit|quota|authentication|api key/i.test(message)) {
      return res.status(422).json({ error: message, code: "LLM_OPTIMIZATION_UNAVAILABLE" });
    }

    if (/target total|priceditems|required|positive number/i.test(message)) {
      return res.status(400).json({ error: message, code: "INVALID_OPTIMIZER_INPUT" });
    }

    return res.status(500).json({ error: message, code: "OPTIMIZER_INTERNAL_ERROR" });
  }
}
