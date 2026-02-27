import { Router } from "express";
import multer from "multer";
import path from "path";
import { Request, Response, NextFunction } from "express";
import { authenticateToken } from "../middleware/auth";
import * as controller from "./boq.controller";
import { pool } from "../../config/db";

const router = Router();
const maxUploadSizeBytes = Number(process.env.BOQ_UPLOAD_MAX_BYTES || 4 * 1024 * 1024);

// Configure multer for file upload
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let projectId = req.params.projectId;
    if (Array.isArray(projectId)) {
      projectId = projectId[0];
    }
    if (!projectId) {
      return cb(new Error("projectId is required for BOQ upload"), "");
    }
    
    // Use /tmp for serverless (Vercel), uploads for local
    const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
    const uploadPath = isProduction
      ? path.join("/tmp", "boq", projectId)
      : path.join("uploads", "boq", projectId);
    
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

const parseUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadSizeBytes },
});

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: maxUploadSizeBytes },
});

function handleMulterSingle(fieldName: string, uploader: multer.Multer) {
  return (req: Request, res: Response, next: NextFunction) => {
    uploader.single(fieldName)(req, res, (err: any) => {
      if (!err) {
        return next();
      }

      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: `File is too large. Maximum allowed size is ${Math.floor(maxUploadSizeBytes / (1024 * 1024))}MB`,
            code: err.code,
          });
        }

        return res.status(400).json({ error: err.message, code: err.code });
      }

      return res.status(400).json({ error: err?.message || "Invalid upload request" });
    });
  };
}

// Parse BOQ file for preview (architect)
router.post(
  "/parse",
  authenticateToken,
  handleMulterSingle("boq", parseUpload),
  controller.parseBOQ
);

async function checkProjectOwnership(req: Request, res: Response, next: NextFunction) {
  let projectId = req.params.projectId;
  if (Array.isArray(projectId)) projectId = projectId[0];
  const user = (req as any).user || {};
  const userId = user.userId || user.id || user.sub;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized user." });
  }

  if (!projectId) {
    return res.status(400).json({ message: "Project ID is required." });
  }

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

router.post(
  "/:projectId/upload",
  authenticateToken,
  checkProjectOwnership,
  handleMulterSingle("boq", upload),
  controller.uploadBOQ
);

router.get("/:projectId/check", authenticateToken, controller.checkBOQ);

router.get("/:projectId", authenticateToken, controller.getBOQ);

router.get("/:projectId/download", authenticateToken, controller.downloadBOQ);

router.delete("/:projectId", authenticateToken, controller.deleteBOQ);

export default router;