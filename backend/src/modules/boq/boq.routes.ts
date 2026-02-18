import { Router } from "express";
import multer from "multer";
import { uploadBoq } from "./boq.controller";

const router = Router();

const upload = multer({ dest: "uploads/" });

router.post("/:projectId/boq", upload.single("file"), uploadBoq);

export default router;