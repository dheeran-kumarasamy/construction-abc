import { Router } from "express";
import {
  getAvailableProjects,
  getProjectBOQItems,
  getBuilderBasePricing,
  createOrUpdateEstimate,
  getSubmittedEstimates,
  getSubmittedEstimateHistory,
  optimizeEstimateTarget,
} from "./builder.controller";

const router = Router();

// Get projects available for builder to submit estimates
router.get("/available-projects", getAvailableProjects);

// Get BOQ items for a specific project
router.get("/projects/:projectId/boq-items", getProjectBOQItems);

// Get builder's base pricing
router.get("/base-pricing", getBuilderBasePricing);

// Create or update estimate with pricing
router.post("/projects/:projectId/estimate", createOrUpdateEstimate);

// Get optimization suggestions to reach target total
router.post("/projects/:projectId/optimize-target", optimizeEstimateTarget);

// Get submitted estimates for logged-in builder
router.get("/submitted-estimates", getSubmittedEstimates);

// Get revision + review history for a submitted estimate
router.get("/submitted-estimates/:estimateId/history", getSubmittedEstimateHistory);

export default router;
