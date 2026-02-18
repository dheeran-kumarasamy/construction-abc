import { Router } from "express";
import {
  createEstimateDraft,
  submitEstimateRevision,
  getMyEstimate,
  getProjectEstimates,
} from "./estimate.controller";

const router = Router();

router.post("/projects/:projectId/estimates", createEstimateDraft);
router.post("/estimates/:estimateId/submit", submitEstimateRevision);
router.get("/projects/:projectId/my-estimate", getMyEstimate);
router.get("/projects/:projectId/estimates", getProjectEstimates);

export default router