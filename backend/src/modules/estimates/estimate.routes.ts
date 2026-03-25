import { Router } from "express";
import {
  createEstimateDraft,
  submitEstimateRevision,
  getMyEstimate,
  getProjectEstimates,
  postEstimateReview,
  getEstimateHistory,
  getTeamApprovalLog,
} from "./estimate.controller";

const router = Router();

router.post("/projects/:projectId/estimates", createEstimateDraft);
router.post("/estimates/:estimateId/submit", submitEstimateRevision);
router.get("/projects/:projectId/my-estimate", getMyEstimate);
router.get("/projects/:projectId/estimates", getProjectEstimates);
router.post("/projects/:projectId/estimates/:estimateId/review", postEstimateReview);
router.get("/projects/:projectId/estimates/:estimateId/history", getEstimateHistory);
router.get("/architect/team-approvals", getTeamApprovalLog);

export default router