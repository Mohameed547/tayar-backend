import { Router } from "express";
import { getAllDrivers, updateDriverStatus, updateDriverAvailability } from "./drivers.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { validate } from "../../shared/middleware/validate.js";
import { ROLES } from "../../shared/constants/roles.js";
import { updateDriverStatusSchema, updateDriverAvailabilitySchema } from "./drivers.validation.js";

import { checkVerified } from "../../shared/middleware/checkVerified.js";

const router = Router();

router.use(authenticate);

router.patch(
  "/availability",
  authorize(ROLES.CAPTAIN),
  checkVerified,
  validate(updateDriverAvailabilitySchema),
  updateDriverAvailability,
);

router.get("/admin/all", authorize(ROLES.ADMIN), getAllDrivers);
router.patch(
  "/admin/:id/status",
  authorize(ROLES.ADMIN),
  validate(updateDriverStatusSchema),
  updateDriverStatus,
);

export default router;
