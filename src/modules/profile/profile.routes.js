import { Router } from "express";
import { getMyProfile, updateMyProfile } from "./profile.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";

const router = Router();

router.get("/getProfile", authenticate, getMyProfile);
router.patch("/updateProfile", authenticate, updateMyProfile);

export default router;
