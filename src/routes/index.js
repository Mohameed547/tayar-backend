import { Router } from "express";
import shipmentRoutes from "../modules/shipments/shipments.routes.js";
import supportRoutes from "../modules/support/support.routes.js";
import walletRoutes from "../modules/wallet/wallet.routes.js";

const router = Router();

router.use("/shipments", shipmentRoutes);
router.use("/support", supportRoutes);
router.use("/wallet", walletRoutes);
export default router;
