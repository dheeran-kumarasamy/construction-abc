import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import {
  // SOR Reference
  getResources,
  getTemplates,
  getTemplateById,
  getLocationZones,
  getConveyanceSlabs,
  getPlinthAreaRates,
  // Template CRUD
  createTemplate,
  updateTemplate,
  deleteTemplate,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  // Rate Computation
  computeRate,
  computeRateBatch,
  // BOQ Projects
  createProject,
  listProjects,
  listInvitedProjects,
  getProject,
  updateProject,
  deleteProject as deleteProjectHandler,
  // BOQ Sections
  createSection,
  listSections,
  updateSection,
  deleteSection,
  // BOQ Items
  createItem,
  listItems,
  updateItem,
  deleteItem,
  // Compute & Summary
  computeAllItems,
  getProjectSummary,
  // Export
  exportProject,
  // Plinth Area Validation
  validatePlinthArea,
} from "./estimation.controller";

const router = Router();

// ── SOR Reference (public, cacheable) ──────────
router.get("/sor/resources", getResources);
router.get("/sor/templates", getTemplates);
router.get("/sor/templates/:id", getTemplateById);
router.get("/sor/location-zones", getLocationZones);
router.get("/sor/conveyance-slabs", getConveyanceSlabs);
router.get("/sor/plinth-area-rates", getPlinthAreaRates);

// ── Template CRUD (authenticated) ──────────────
router.post("/templates", authenticate, createTemplate);
router.put("/templates/:id", authenticate, updateTemplate);
router.delete("/templates/:id", authenticate, deleteTemplate);
router.post("/templates/:templateId/line-items", authenticate, addLineItem);
router.put("/line-items/:id", authenticate, updateLineItem);
router.delete("/line-items/:id", authenticate, deleteLineItem);

// ── Rate Computation (authenticated) ───────────
router.post("/compute/rate", authenticate, computeRate);
router.post("/compute/batch", authenticate, computeRateBatch);

// ── BOQ Projects (authenticated) ───────────────
router.post("/projects", authenticate, createProject);
router.get("/projects", authenticate, listProjects);
router.get("/projects/invited", authenticate, listInvitedProjects);
router.get("/projects/:id", authenticate, getProject);
router.put("/projects/:id", authenticate, updateProject);
router.delete("/projects/:id", authenticate, deleteProjectHandler);

// ── BOQ Sections ────────────────────────────────
router.post("/projects/:projectId/sections", authenticate, createSection);
router.get("/projects/:projectId/sections", authenticate, listSections);
router.put("/sections/:id", authenticate, updateSection);
router.delete("/sections/:id", authenticate, deleteSection);

// ── BOQ Items ───────────────────────────────────
router.post("/items", authenticate, createItem);
router.get("/projects/:projectId/items", authenticate, listItems);
router.put("/items/:id", authenticate, updateItem);
router.delete("/items/:id", authenticate, deleteItem);

// ── Compute All & Summary ───────────────────────
router.post("/projects/:projectId/compute-all", authenticate, computeAllItems);
router.get("/projects/:projectId/summary", authenticate, getProjectSummary);

// ── Excel Export ────────────────────────────────
router.get("/projects/:projectId/export", authenticate, exportProject);

// ── Plinth Area Validation ─────────────────────
router.post("/projects/:projectId/validate-plinth", authenticate, validatePlinthArea);

export default router;
