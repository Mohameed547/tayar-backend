import { Router } from "express";
import { getMyProfile, updateMyProfile, changeMyPassword, updateMyAvatar } from "./profile.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";

const router = Router();

router.get("/getProfile", authenticate, getMyProfile);
router.patch("/updateProfile", authenticate, updateMyProfile);

// REST-style aliases
router.get("/", authenticate, getMyProfile);
router.patch("/", authenticate, updateMyProfile);
router.patch("/password", authenticate, changeMyPassword);
router.patch("/avatar", authenticate, updateMyAvatar);

export default router;
