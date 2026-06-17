import { Router } from "express";
import shipmentRoutes from "../modules/shipments/shipments.routes.js";
import supportRoutes from "../modules/support/support.routes.js";

const router = Router();

router.use("/shipments", shipmentRoutes);
router.use("/support", supportRoutes);

export default router;
