import { Router } from "express";
// import authRoutes from "../modules/auth/auth.routes.js";
import profileRoutes from "../modules/profile/profile.router.js";
import reviewsRoutes from "../modules/reviews/reviews.routes.js";
const router = Router();

// router.use("/auth", authRoutes);
router.use("/users", profileRoutes);
router.use("/reviews", reviewsRoutes);

export default router;
