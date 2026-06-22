import { Router } from "express";
import { getRevenue } from "./revenue.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { ROLES } from "../../shared/constants/roles.js";

const router = Router();

router.use(authenticate);
router.get("/admin", authorize(ROLES.ADMIN), getRevenue);

export default router;
