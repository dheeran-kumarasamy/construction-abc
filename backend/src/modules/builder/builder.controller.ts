import { Request, Response } from "express";
import * as service from "./builder.service";
import { pool } from "../../config/db";
import fs from "fs";

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

export async function markProjectInProgress(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
    const user = (req as any).user;
    const userId = user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const builderOrgId = user?.organizationId || (await resolveBuilderOrganizationId(userId, projectIdStr));

    if (!builderOrgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await service.markEstimateInProgress(projectIdStr, userId, builderOrgId);
    return res.json(result);
  } catch (error) {
    console.error("Mark project in progress error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update project status",
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
    const { pricedItems, marginConfig, notes, basicMaterialCost } = req.body;

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
      notes,
      basicMaterialCost
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

// ── Builder Profile ────────────────────────────────────────

export async function getMyBuilderProfile(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const profile = await service.getBuilderProfile(userId);
    return res.json(profile || { profileComplete: false });
  } catch (err: any) {
    console.error("getMyBuilderProfile error:", err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
}

export async function updateMyBuilderProfile(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      companyName,
      contactPhone,
      serviceLocations,
      specialties,
      pastProjects,
      portfolioLinks,
      portfolioPhotos,
      teamSize,
      minProjectBudget,
      isVisibleToArchitects,
    } = req.body;

    const profile = await service.upsertBuilderProfile(userId, {
      companyName,
      contactPhone,
      serviceLocations,
      specialties,
      pastProjects,
      portfolioLinks,
      portfolioPhotos: Array.isArray(portfolioPhotos)
        ? portfolioPhotos.map((item) => String(item || "").trim()).filter(Boolean)
        : undefined,
      teamSize: teamSize !== undefined ? Number(teamSize) : undefined,
      minProjectBudget: minProjectBudget !== undefined ? Number(minProjectBudget) : undefined,
      isVisibleToArchitects,
    });
    return res.json(profile);
  } catch (err: any) {
    console.error("updateMyBuilderProfile error:", err);
    return res.status(500).json({ error: "Failed to save profile" });
  }
}

export async function listBuildersForArchitect(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const organizationId = user?.organizationId;
    if (!organizationId) return res.status(400).json({ error: "No organization associated with this account" });
    const builders = await service.listBuilderProfilesForOrg(organizationId);
    return res.json(builders);
  } catch (err: any) {
    console.error("listBuildersForArchitect error:", err);
    return res.status(500).json({ error: "Failed to fetch builder directory" });
  }
}

export async function uploadMyBuilderPortfolioPhotos(req: Request, res: Response) {
  const uploadedFiles = ((req.files as Express.Multer.File[]) || []);

  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    if (!uploadedFiles.length) {
      return res.status(400).json({ error: "No photos uploaded" });
    }

    const existing = await service.getBuilderProfile(userId);
    const existingPhotos = Array.isArray(existing?.portfolioPhotos) ? existing.portfolioPhotos : [];
    if (existingPhotos.length + uploadedFiles.length > 10) {
      uploadedFiles.forEach((file) => {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      return res.status(400).json({ error: "Portfolio can contain at most 10 photos" });
    }

    const newPhotoPaths = uploadedFiles.map((file) => `builder-portfolio/${file.filename}`);
    const mergedPhotos = [...existingPhotos, ...newPhotoPaths];

    const profile = await service.upsertBuilderProfile(userId, {
      portfolioPhotos: mergedPhotos,
    });

    return res.json({
      message: "Portfolio photos uploaded",
      portfolioPhotos: profile.portfolioPhotos || [],
    });
  } catch (err: any) {
    uploadedFiles.forEach((file) => {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
    console.error("uploadMyBuilderPortfolioPhotos error:", err);
    return res.status(500).json({ error: "Failed to upload portfolio photos" });
  }
}
