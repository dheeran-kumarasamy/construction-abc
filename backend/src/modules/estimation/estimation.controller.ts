import { Request, Response } from "express";
import * as service from "./estimation.service";

function getUserId(req: Request): string {
  return (req as any)?.user?.userId;
}

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// ── SOR Reference ──────────────────────────────

export async function getResources(req: Request, res: Response) {
  try {
    const { type, category, annexure, search } = req.query as Record<string, string>;
    const resources = await service.listResources({ type, category, annexure, search });
    res.json(resources);
  } catch (err: any) {
    console.error("getResources error:", err);
    res.status(500).json({ error: "Failed to fetch resources" });
  }
}

export async function getTemplates(req: Request, res: Response) {
  try {
    const { category, search } = req.query as Record<string, string>;
    const templates = await service.listTemplates({ category, search });
    res.json(templates);
  } catch (err: any) {
    console.error("getTemplates error:", err);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
}

export async function getTemplateById(req: Request, res: Response) {
  try {
    const template = await service.getTemplateDetail(param(req, "id"));
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (err: any) {
    console.error("getTemplateById error:", err);
    res.status(500).json({ error: "Failed to fetch template" });
  }
}

// ── Template CRUD ───────────────────────────────

export async function createTemplate(req: Request, res: Response) {
  try {
    const template = await service.createTemplate(req.body);
    res.status(201).json(template);
  } catch (err: any) {
    console.error("createTemplate error:", err);
    res.status(500).json({ error: err.message || "Failed to create template" });
  }
}

export async function updateTemplate(req: Request, res: Response) {
  try {
    const template = await service.updateTemplate(param(req, "id"), req.body);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (err: any) {
    console.error("updateTemplate error:", err);
    res.status(500).json({ error: err.message || "Failed to update template" });
  }
}

export async function deleteTemplate(req: Request, res: Response) {
  try {
    await service.deleteTemplate(param(req, "id"));
    res.json({ success: true });
  } catch (err: any) {
    console.error("deleteTemplate error:", err);
    res.status(500).json({ error: "Failed to delete template" });
  }
}

export async function addLineItem(req: Request, res: Response) {
  try {
    const item = await service.addLineItem(param(req, "templateId"), req.body);
    res.status(201).json(item);
  } catch (err: any) {
    console.error("addLineItem error:", err);
    res.status(500).json({ error: err.message || "Failed to add line item" });
  }
}

export async function updateLineItem(req: Request, res: Response) {
  try {
    const item = await service.updateLineItem(param(req, "id"), req.body);
    if (!item) return res.status(404).json({ error: "Line item not found" });
    res.json(item);
  } catch (err: any) {
    console.error("updateLineItem error:", err);
    res.status(500).json({ error: err.message || "Failed to update line item" });
  }
}

export async function deleteLineItem(req: Request, res: Response) {
  try {
    await service.deleteLineItem(param(req, "id"));
    res.json({ success: true });
  } catch (err: any) {
    console.error("deleteLineItem error:", err);
    res.status(500).json({ error: "Failed to delete line item" });
  }
}

export async function getLocationZones(req: Request, res: Response) {
  try {
    const zones = await service.listLocationZones();
    res.json(zones);
  } catch (err: any) {
    console.error("getLocationZones error:", err);
    res.status(500).json({ error: "Failed to fetch location zones" });
  }
}

export async function getConveyanceSlabs(req: Request, res: Response) {
  try {
    const terrain = req.query.terrain as string | undefined;
    const slabs = await service.listConveyanceSlabs(terrain);
    res.json(slabs);
  } catch (err: any) {
    console.error("getConveyanceSlabs error:", err);
    res.status(500).json({ error: "Failed to fetch conveyance slabs" });
  }
}

export async function getPlinthAreaRates(req: Request, res: Response) {
  try {
    const rates = await service.listPlinthAreaRates();
    res.json(rates);
  } catch (err: any) {
    console.error("getPlinthAreaRates error:", err);
    res.status(500).json({ error: "Failed to fetch plinth area rates" });
  }
}

// ── Rate Computation ───────────────────────────

export async function computeRate(req: Request, res: Response) {
  try {
    const result = await service.computeSingleRate(req.body);
    res.json(result);
  } catch (err: any) {
    console.error("computeRate error:", err);
    res.status(400).json({ error: err.message || "Rate computation failed" });
  }
}

export async function computeRateBatch(req: Request, res: Response) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: "items must be an array" });
    const results = await service.computeBatchRates(items);
    res.json(results);
  } catch (err: any) {
    console.error("computeRateBatch error:", err);
    res.status(400).json({ error: err.message || "Batch computation failed" });
  }
}

// ── BOQ Projects ───────────────────────────────

export async function createProject(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const project = await service.createProject(userId, req.body);
    res.status(201).json(project);
  } catch (err: any) {
    console.error("createProject error:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
}

export async function listProjects(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const projects = await service.listProjects(userId);
    res.json(projects);
  } catch (err: any) {
    console.error("listProjects error:", err);
    res.status(500).json({ error: "Failed to list projects" });
  }
}

export async function listInvitedProjects(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const projects = await service.listInvitedProjects(userId);
    res.json(projects);
  } catch (err: any) {
    console.error("listInvitedProjects error:", err);
    res.status(500).json({ error: "Failed to list invited projects" });
  }
}

export async function getProject(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const project = await service.getProject(param(req, "id"), userId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err: any) {
    console.error("getProject error:", err);
    res.status(500).json({ error: "Failed to fetch project" });
  }
}

export async function updateProject(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const project = await service.updateProject(param(req, "id"), userId, req.body);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err: any) {
    console.error("updateProject error:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
}

export async function deleteProject(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const deleted = await service.deleteProject(param(req, "id"), userId);
    if (!deleted) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true });
  } catch (err: any) {
    console.error("deleteProject error:", err);
    res.status(500).json({ error: "Failed to delete project" });
  }
}

// ── BOQ Sections ───────────────────────────────

export async function createSection(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const section = await service.createSection(param(req, "projectId"), userId, req.body);
    if (!section) return res.status(404).json({ error: "Project not found" });
    res.status(201).json(section);
  } catch (err: any) {
    console.error("createSection error:", err);
    res.status(500).json({ error: "Failed to create section" });
  }
}

export async function listSections(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const sections = await service.listSections(param(req, "projectId"), userId);
    res.json(sections);
  } catch (err: any) {
    console.error("listSections error:", err);
    res.status(500).json({ error: "Failed to list sections" });
  }
}

export async function updateSection(req: Request, res: Response) {
  try {
    const section = await service.updateSection(param(req, "id"), req.body);
    if (!section) return res.status(404).json({ error: "Section not found" });
    res.json(section);
  } catch (err: any) {
    console.error("updateSection error:", err);
    res.status(500).json({ error: "Failed to update section" });
  }
}

export async function deleteSection(req: Request, res: Response) {
  try {
    const deleted = await service.deleteSection(param(req, "id"));
    if (!deleted) return res.status(404).json({ error: "Section not found" });
    res.json({ success: true });
  } catch (err: any) {
    console.error("deleteSection error:", err);
    res.status(500).json({ error: "Failed to delete section" });
  }
}

// ── BOQ Items ──────────────────────────────────

export async function createItem(req: Request, res: Response) {
  try {
    const item = await service.createItem(req.body);
    res.status(201).json(item);
  } catch (err: any) {
    console.error("createItem error:", err);
    res.status(500).json({ error: "Failed to create item" });
  }
}

export async function listItems(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const sectionId = req.query.section_id as string | undefined;
    const items = await service.listItems(param(req, "projectId"), sectionId, userId);
    res.json(items);
  } catch (err: any) {
    console.error("listItems error:", err);
    res.status(500).json({ error: "Failed to list items" });
  }
}

export async function updateItem(req: Request, res: Response) {
  try {
    const item = await service.updateItem(param(req, "id"), req.body);
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (err: any) {
    console.error("updateItem error:", err);
    res.status(500).json({ error: "Failed to update item" });
  }
}

export async function deleteItem(req: Request, res: Response) {
  try {
    const deleted = await service.deleteItem(param(req, "id"));
    if (!deleted) return res.status(404).json({ error: "Item not found" });
    res.json({ success: true });
  } catch (err: any) {
    console.error("deleteItem error:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
}

// ── Compute All + Summary ──────────────────────

export async function computeAllItems(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const results = await service.computeAllProjectItems(param(req, "projectId"), userId);
    if (!results) return res.status(404).json({ error: "Project not found" });
    res.json(results);
  } catch (err: any) {
    console.error("computeAllItems error:", err);
    res.status(500).json({ error: "Failed to compute items" });
  }
}

export async function getProjectSummary(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const summary = await service.getProjectSummary(param(req, "projectId"), userId);
    if (!summary) return res.status(404).json({ error: "Project not found" });
    res.json(summary);
  } catch (err: any) {
    console.error("getProjectSummary error:", err);
    res.status(500).json({ error: "Failed to get summary" });
  }
}

// ── Excel Export ────────────────────────────────

export async function exportProject(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const { exportProjectExcel } = await import("./excelExport");
    await exportProjectExcel(param(req, "projectId"), userId, res);
  } catch (err: any) {
    console.error("exportProject error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Export failed" });
    }
  }
}

// ── Plinth Area Validation ─────────────────────

export async function validatePlinthArea(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const result = await service.validatePlinthArea(param(req, "projectId"), userId, req.body);
    res.json(result);
  } catch (err: any) {
    console.error("validatePlinthArea error:", err);
    res.status(500).json({ error: err.message || "Validation failed" });
  }
}

export async function getFingerInAirEstimate(req: Request, res: Response) {
  try {
    const result = await service.getFingerInAirEstimate(req.body || {});
    res.json(result);
  } catch (err: any) {
    console.error("getFingerInAirEstimate error:", err);
    res.status(500).json({ error: err.message || "Quick estimate failed" });
  }
}
