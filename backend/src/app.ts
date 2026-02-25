import express from "express";
import cors, { CorsOptions } from "cors";
import authRoutes from "./modules/auth/auth.routes";
import projectRoutes from "./modules/projects/project.routes";
import boqRoutes from "./modules/boq/boq.routes";
import estimateRoutes from "./modules/estimates/estimate.routes";
import { authenticate } from "./modules/auth/auth.middleware";
import comparisonRoutes from "./modules/comparison/comparison.routes";
import basePricingRoutes from "./modules/base-pricing/base-pricing.routes";
import builderRoutes from "./modules/builder/builder.routes";

export const app = express();

const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    const isVercelFrontendPreview = /^https:\/\/.*-frontend-.*\.vercel\.app$/i.test(origin);
    const isConfiguredOrigin = configuredOrigins.includes(origin);

    if (isLocalOrigin || isVercelFrontendPreview || isConfiguredOrigin) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.get(["/favicon.ico", "/favicon.png"], (_req, res) => {
  res.status(204).end();
});

app.use("/auth", authRoutes);
app.use("/projects", authenticate, projectRoutes);
app.use("/api/projects", authenticate, projectRoutes);
app.use("/projects", authenticate, boqRoutes);
app.use("/", authenticate, estimateRoutes);
app.use("/", authenticate, comparisonRoutes);

app.use("/api/boq", boqRoutes);
app.use("/api/base-pricing", authenticate, basePricingRoutes);
app.use("/api/builder", authenticate, builderRoutes);
