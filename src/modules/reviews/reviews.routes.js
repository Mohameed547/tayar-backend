import { Router } from "express";
import * as Y from "./reviews.controller.js";
import authenticate from "../../shared/middleware/authenticate.js";

const router = Router();

router.get("/getReview", authenticate, Y.getMyReviews);
router.post("/addReview", authenticate, Y.createReview);

export default router;
