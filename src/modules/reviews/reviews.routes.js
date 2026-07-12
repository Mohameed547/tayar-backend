import { Router } from "express";
import * as Y from "./reviews.controller.js";
import { authenticate } from "../../shared/middleware/authenticate.js";

import { checkVerified } from "../../shared/middleware/checkVerified.js";

const router = Router();

router.use(authenticate, checkVerified);

router.get("/getReview", Y.getMyReviews);
router.post("/addReview", Y.createReview);

export default router;
