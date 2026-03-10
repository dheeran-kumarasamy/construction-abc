import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import { listNotifications } from "../prices/prices.controller";

const router = Router();

router.get("/", authenticate, listNotifications);

export default router;
