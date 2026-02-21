import { Router } from "express";
import multer from "multer";
import path from "path";
import { parseBasePricing, uploadBasePricingFile } from "./base-pricing.controller";

const router = Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(process.cwd(), "uploads/base-pricing"));
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
