import { Router } from "express";
import { getCaptainDashboard } from "./captain-dashboard.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { ROLES } from "../../shared/constants/roles.js";

const router = Router();

router.use(authenticate);

// ROLES.CAPTAIN currently aliases to the stored value "driver" — see
// shared/constants/roles.js. Using the constant here (not the literal
// string) so this route stays correct if that mapping ever changes.
router.get("/", authorize(ROLES.CAPTAIN), getCaptainDashboard);

export default router;
