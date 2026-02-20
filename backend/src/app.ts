import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes";
import projectRoutes from "./modules/projects/project.routes";
import boqRoutes from "./modules/boq/boq.routes";
import estimateRoutes from "./modules/estimates/estimate.routes";
import { authenticate } from "./modules/auth/auth.middleware";
import comparisonRoutes from "./modules/comparison/comparison.routes";

export const app = express();

app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/projects", authenticate, projectRoutes);
app.use("/projects", authenticate, boqRoutes);
app.use("/", authenticate, estimateRoutes);
app.use("/", authenticate, comparisonRoutes);

app.use("/api/boq", boqRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
