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
	sendOtp,
} from "./auth.controller";
import { authenticate } from "./auth.middleware";
import { googleOAuthCallback, validateToken } from "./oauth.controller";

const router = Router();

router.post("/login", login);
router.post("/otp/send", sendOtp);
router.post("/register", register);
router.post("/reset-password", resetPassword);
router.post("/accept-invite", acceptInvite);
router.post("/invite", authenticate, inviteUser);
router.get("/invites", authenticate, getInvites);
router.get("/me", authenticate, getMyProfile);
router.patch("/me/phone", authenticate, updateMyPhoneNumber);
router.post("/oauth/google-callback", googleOAuthCallback);
router.post("/oauth/validate-token", validateToken);

export default router;