import { Router } from "express";
import { login, acceptInvite, inviteUser, getInvites } from "./auth.controller";
import { authenticate } from "./auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/accept-invite", acceptInvite);
router.post("/invite", authenticate, inviteUser);
router.get("/invites", authenticate, getInvites);

export default router;