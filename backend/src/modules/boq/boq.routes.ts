import { Router } from "express";
import multer from "multer";
import path from "path";
import { authenticateToken } from "../middleware/auth";
import * as controller from "./boq.controller";


const router = Router();


import { Request, Response, NextFunction } from "express";
import { pool } from "../../config/db";

async function checkProjectOwnership(req: Request, res: Response, next: NextFunction) {
  let projectId = req.params.projectId;
  if (Array.isArray(projectId)) projectId = projectId[0];
  const userId = (req as any).user?.userId;
  try {
    const result = await pool.query(
      "SELECT id FROM projects WHERE id = $1 AND architect_id = $2",
      [projectId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ message: "You do not have access to this project." });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: "Error checking project ownership", error: err } );
  }
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let projectId = req.params.projectId;
    if (Array.isArray(projectId)) {
      projectId = projectId[0];
    }
    const uploadPath = path.join("uploads", "boq", projectId);
    import("fs").then(fs => {
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    });
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "boq-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

router.post(
  "/:projectId/upload",
  authenticateToken,
  checkProjectOwnership, // <-- Add this middleware
  upload.single("boq"),
  controller.uploadBOQ
);

router.get("/:projectId", authenticateToken, controller.getBOQ);

router.get("/:projectId/download", authenticateToken, controller.downloadBOQ);

router.delete("/:projectId", authenticateToken, controller.deleteBOQ);

export default router;