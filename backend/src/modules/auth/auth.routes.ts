import { Router } from "express";
import { login, acceptInvite, inviteUser } from "./auth.controller";
import { authenticate } from "./auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/accept-invite", acceptInvite);
router.post("/invite", authenticate, inviteUser);

export default router;