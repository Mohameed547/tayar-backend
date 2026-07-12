import { Router } from "express";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { validate } from "../../shared/middleware/validate.js";
import { updateProfileSchema, pushTokenSchema } from "./users.validation.js";
import { scheduleDeletionSchema } from "../../shared/validators/account.js";
import { accountLifecycleLimiter } from "../../shared/middleware/rateLimiter.js";
import {
  getMe,
  updateMe,
  addPushToken,
  removePushToken,
  deleteMe,
  restoreMe,
  getDeleteStatus,
} from "./users.controller.js";

const router = Router();

router.use(authenticate);

router.get("/me", getMe);
router.patch("/me", validate(updateProfileSchema), updateMe);
router.delete("/me", accountLifecycleLimiter, validate(scheduleDeletionSchema), deleteMe);
router.post("/me/restore", accountLifecycleLimiter, restoreMe);
router.get("/me/delete-status", getDeleteStatus);
router.post("/push-token", validate(pushTokenSchema), addPushToken);
router.delete("/push-token", validate(pushTokenSchema), removePushToken);

export default router;
