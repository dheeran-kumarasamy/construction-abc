import { Router } from "express";
import {
	login,
	register,
	resetPassword,
	acceptInvite,
	inviteUser,
	getInvites,
	getMyProfile,
	updateMyPhoneNumber,
} from "./auth.controller";
import { authenticate } from "./auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.post("/reset-password", resetPassword);
router.post("/accept-invite", acceptInvite);
router.post("/invite", authenticate, inviteUser);
router.get("/invites", authenticate, getInvites);
router.get("/me", authenticate, getMyProfile);
router.patch("/me/phone", authenticate, updateMyPhoneNumber);

export default router;