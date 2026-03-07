import { Router } from "express";
import { login, register, acceptInvite, inviteUser, getInvites } from "./auth.controller";
import { authenticate } from "./auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.post("/accept-invite", acceptInvite);
router.post("/invite", authenticate, inviteUser);
router.get("/invites", authenticate, getInvites);

export default router;