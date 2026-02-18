import { Router } from "express";
import { createProject, getProjects } from "./project.controller";

const router = Router();

router.get("/", getProjects);
router.post("/", createProject);

export default router;