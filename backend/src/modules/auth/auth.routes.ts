
import { Router } from "express";
import { login, acceptInvite, inviteUser } from "./auth.controller";

const router = Router();


router.post("/login", login);
router.post("/accept-invite", acceptInvite);
router.post("/invite", inviteUser);


export default router;