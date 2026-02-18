import { Request, Response } from "express";
import * as service from "./estimate.service";
// TODO: Update the import below to the correct path where your db client is defined
// Example: import { client, pool } from "../../db"; 
// Update the path below to the actual location of your db client (pool, client)
// TODO: Update the import below to the correct path where your db client is defined
// import { pool, client } from "../../db"; // Example: adjust the path as needed

// Temporary mock for pool and client to avoid import error
const pool = { query: async (...args: any[]) => ({ rows: [] }) };
const client = { query: async (...args: any[]) => ({ rows: [] }) };

export async function createEstimateDraft(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const authUser = (req as any).user || {};
    const userId = authUser.userId || null;
    const builderOrgId = authUser.organizationId || null;

    const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;

    const result = await service.createDraft(projectIdStr, builderOrgId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function submitEstimateRevision(req: Request, res: Response) {
  try {
    const { estimateId } = req.params;
    const { marginPercent, notes } = req.body || {};
    const authUser = (req as any).user || {};
    const userId = authUser.userId || null;
    const builderOrgId = authUser.organizationId || null;

    const estimateIdStr = Array.isArray(estimateId) ? estimateId[0] : estimateId;

    const result = await service.submitRevision(
      estimateIdStr,
      userId,
      marginPercent,
      notes
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getMyEstimate(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const authUser = (req as any).user || {};
    const userId = authUser.userId || null;
    const builderOrgId = authUser.organizationId || null;

    const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;

    const result = await service.getBuilderEstimate(projectIdStr, builderOrgId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getProjectEstimates(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;

    const result = await service.getAllProjectEstimates(projectIdStr);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function createDraft(projectId: string, builderOrgId: string | null) {
  if (!builderOrgId) {
    throw new Error("Unauthorized: builder organization id required");
  }
  // ... use builderOrgId in queries
}

export async function submitRevision(
  estimateId: string,
  builderOrgId: string | null,
  userId: string | null,
  marginPercent: number = 0,
  notes?: string
) {
  if (!builderOrgId) {
    throw new Error("Unauthorized: builder organization id required");
  }

  const estRes = await client.query(
    `SELECT * FROM estimates WHERE id = $1 AND builder_org_id = $2 FOR UPDATE`,
    [estimateId, builderOrgId]
  );

  // ... use userId in audit log if present
}

export async function getBuilderEstimate(projectId: string, builderOrgId: string | null) {
  const res = await pool.query(
    `SELECT * FROM estimates WHERE project_id = $1 AND builder_org_id = $2`,
    [projectId, builderOrgId]
  );
  return res.rows[0] || null;
}