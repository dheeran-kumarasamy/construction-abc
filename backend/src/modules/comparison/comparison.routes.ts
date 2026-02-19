import { Router } from "express";
import { getProjectComparison, awardProject } from "./comparison.controller";

const router = Router();

router.get("/projects/:projectId/comparison", getProjectComparison);
router.post("/projects/:projectId/award", awardProject);

export default router;