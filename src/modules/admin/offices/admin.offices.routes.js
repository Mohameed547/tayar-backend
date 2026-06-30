import { Router } from "express";
import { authenticate } from "../../../shared/middleware/authenticate.js";
import { authorize } from "../../../shared/middleware/authorize.js";
import { validate } from "../../../shared/middleware/validate.js";
import { updateOfficeStatusSchema } from "./admin.offices.validation.js";
import {
  getOffices,
  getStats,
  getOfficeById,
  updateOfficeStatus,
} from "./admin.offices.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorize("admin"));

router.get("/stats", getStats);
router.get("/", getOffices);
router.get("/:id", getOfficeById);
router.patch(
  "/:id/status",
  validate(updateOfficeStatusSchema),
  updateOfficeStatus,
);

export default router;
