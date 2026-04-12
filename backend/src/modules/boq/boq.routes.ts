import { Router } from "express";
import multer from "multer";
import path from "path";
import { Request, Response, NextFunction } from "express";
import { authenticateToken } from "../middleware/auth";
import * as controller from "./boq.controller";
import { pool } from "../../config/db";

const router = Router();
const maxUploadSizeBytes = Number(process.env.BOQ_UPLOAD_MAX_BYTES || 3 * 1024 * 1024);
const uploadRoot = process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads");

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
    
    const uploadPath = path.join(uploadRoot, "boq", projectId);
    
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
  let incomingProjectId = req.params.projectId;
  if (Array.isArray(incomingProjectId)) incomingProjectId = incomingProjectId[0];
  const user = (req as any).user || {};
  const userId = user.userId || user.id || user.sub;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized user." });
  }

  if (!incomingProjectId) {
    return res.status(400).json({ message: "Project ID is required." });
  }

  try {
    let resolvedProjectId: string | null = null;

    const projectResult = await pool.query(
      `SELECT p.id
       FROM projects p
       JOIN users requester ON requester.id = $2
       JOIN users project_architect ON project_architect.id = p.architect_id
       WHERE p.id = $1
         AND LOWER(requester.role) = 'architect'
         AND (
           p.architect_id = requester.id
           OR (
             requester.organization_id IS NOT NULL
             AND requester.organization_id = project_architect.organization_id
           )
         )
       LIMIT 1`,
      [incomingProjectId, userId]
    );

    if (projectResult.rows.length > 0) {
      resolvedProjectId = projectResult.rows[0].id;
    } else {
      const mappedResult = await pool.query(
        `SELECT p.id
         FROM boq_projects bp
         JOIN users requester ON requester.id = $2
         JOIN projects p ON p.id = COALESCE(
           bp.source_project_id,
           CASE
             WHEN bp.notes ~ 'source_project_id:[0-9a-fA-F-]{36}'
             THEN substring(bp.notes from 'source_project_id:([0-9a-fA-F-]{36})')::uuid
             ELSE NULL
           END
         )
         JOIN users project_architect ON project_architect.id = p.architect_id
         WHERE bp.id = $1
           AND LOWER(requester.role) = 'architect'
           AND (
             p.architect_id = requester.id
             OR (
               requester.organization_id IS NOT NULL
               AND requester.organization_id = project_architect.organization_id
             )
           )
         LIMIT 1`,
        [incomingProjectId, userId]
      );

      if (mappedResult.rows.length > 0) {
        resolvedProjectId = mappedResult.rows[0].id;
      }
    }

    if (!resolvedProjectId) {
      return res.status(403).json({ message: "You do not have access to this project." });
    }

    req.params.projectId = resolvedProjectId;
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

router.post("/:projectId/items", authenticateToken, checkProjectOwnership, controller.submitBOQItems);

router.patch("/:projectId/items", authenticateToken, checkProjectOwnership, controller.updateBOQItems);

router.get("/:projectId", authenticateToken, controller.getBOQ);

router.get("/:projectId/download", authenticateToken, controller.downloadBOQ);

router.delete("/:projectId", authenticateToken, controller.deleteBOQ);

export default router;