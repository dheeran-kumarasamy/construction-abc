import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parseBasePricing, uploadBasePricingFile } from "./base-pricing.controller";

const router = Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use /tmp for serverless (Vercel), uploads for local
    const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
    const uploadPath = isProduction 
      ? path.join("/tmp", "base-pricing")
      : path.join(process.cwd(), "uploads", "base-pricing");
    
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

// Parse base pricing file - returns preview and suggested columns
router.post("/parse", upload.single("file"), parseBasePricing);

// Upload and save base pricing to database
router.post("/upload", upload.single("file"), uploadBasePricingFile);

export default router;
