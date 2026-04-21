import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getBasePricingTemplate,
  getPwdStageFactors,
  parseBasePricing,
  uploadBasePricingFile,
  bulkLookupPrices,
} from "./base-pricing.controller";

const router = Router();
const uploadRoot = process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads");

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(uploadRoot, "base-pricing");
    
    // Ensure directory exists
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "base-pricing-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Get pre-populated starter template based on boq-base calculator rates
router.get("/template", getBasePricingTemplate);

// Get PWD stage/material quantity factors for post-submit breakdown
router.get("/stage-factors", getPwdStageFactors);

// Parse base pricing file - returns preview and suggested columns
router.post("/parse", upload.single("file"), parseBasePricing);

// Upload and save base pricing to database
router.post("/upload", upload.single("file"), uploadBasePricingFile);

// Bulk lookup prices for items (e.g., BOQ items)
router.post("/bulk-lookup", bulkLookupPrices);

export default router;
