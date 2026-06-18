import { Router } from "express";
// import authRoutes from "../modules/auth/auth.routes.js";
import profileRoutes from "../modules/profile/profile.routes.js";
import reviewsRoutes from "../modules/reviews/reviews.routes.js";
import offersRoutes from "../modules/offers/offers.routes.js";

const router = Router();

// router.use("/auth", authRoutes);
router.use("/users", profileRoutes);
router.use("/reviews", reviewsRoutes);
router.use("/offers", offersRoutes);

export default router;
