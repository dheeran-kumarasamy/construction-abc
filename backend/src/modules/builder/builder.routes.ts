import { Router } from "express";
import {
  getAvailableProjects,
  getProjectBOQItems,
  getBuilderBasePricing,
  createOrUpdateEstimate,
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

export default router;
