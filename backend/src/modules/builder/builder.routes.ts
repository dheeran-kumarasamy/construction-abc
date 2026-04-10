import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticate } from "../auth/auth.middleware";
import {
  getAvailableProjects,
  getProjectBOQItems,
  markProjectInProgress,
  getBuilderBasePricing,
  createOrUpdateEstimate,
  getSubmittedEstimates,
  getSubmittedEstimateHistory,
  optimizeEstimateTarget,
  getMyBuilderProfile,
  updateMyBuilderProfile,
  listBuildersForArchitect,
  uploadMyBuilderPortfolioPhotos,
} from "./builder.controller";

const router = Router();
const uploadRoot = process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads");

const portfolioPhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.join(uploadRoot, "builder-portfolio");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `portfolio-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const uploadPortfolioPhotos = multer({
  storage: portfolioPhotoStorage,
  limits: {
    files: 10,
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

// ── Builder Profile ────────────────────────────────────────
router.get("/profile", authenticate, getMyBuilderProfile);
router.put("/profile", authenticate, updateMyBuilderProfile);
router.post("/profile/photos", authenticate, (req, res, next) => {
  uploadPortfolioPhotos.array("photos", 10)(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Each photo must be 5MB or smaller" });
    }

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "You can upload at most 10 photos" });
    }

    return res.status(400).json({ error: err.message || "Failed to upload photos" });
  });
}, uploadMyBuilderPortfolioPhotos);

// ── Architect Builder Directory (architect-only) ───────────
router.get("/directory", authenticate, listBuildersForArchitect);

// Get projects available for builder to submit estimates
router.get("/available-projects", getAvailableProjects);

// Get BOQ items for a specific project
router.get("/projects/:projectId/boq-items", getProjectBOQItems);

// Mark a project estimate as in-progress when builder opens it for editing
router.post("/projects/:projectId/in-progress", markProjectInProgress);

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
