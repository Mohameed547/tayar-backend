import { Router } from "express";
import { authenticate } from "../../../shared/middleware/authenticate.js";
import { authorize } from "../../../shared/middleware/authorize.js";
import { getDashboardData } from "./admin.dashboard.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorize("admin"));

router.get("/", getDashboardData);

export default router;
