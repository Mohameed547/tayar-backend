import { Router } from "express";
import { authenticate } from "../../../shared/middleware/authenticate.js";
import { authorize } from "../../../shared/middleware/authorize.js";
import { validate } from "../../../shared/middleware/validate.js";
import { updateUserStatusSchema } from "./admin.users.validation.js";
import {
  getUsers,
  getUserById,
  updateUserStatus,
} from "./admin.users.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorize("admin"));

router.get("/", getUsers);
router.get("/:id", getUserById);
router.patch("/:id/status", validate(updateUserStatusSchema), updateUserStatus);

export default router;
