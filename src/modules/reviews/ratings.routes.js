import { Router } from "express";
import * as reviewsService from "../reviews/reviews.service.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { ROLES } from "../../shared/constants/roles.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

const router = Router();

router.post("/ratings", authenticate, async (req, res, next) => {
    try {
        const review = await reviewsService.createReview(req.user._id, req.body);
        return res.status(201).json(ApiResponse.success(review, "Rating submitted successfully"));
    } catch (err) {
        next(err);
    }
});


router.get(
    "/captain/ratings",
    authenticate,
    authorize(ROLES.CAPTAIN),
    async (req, res, next) => {
        try {
            const ratings = await reviewsService.getReceivedRatings(req.user._id);
            return res.status(200).json(ApiResponse.success(ratings));
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/office/ratings",
    authenticate,
    authorize(ROLES.OFFICE),
    async (req, res, next) => {
        try {
            const ratings = await reviewsService.getReceivedRatings(req.user._id);
            return res.status(200).json(ApiResponse.success(ratings));
        } catch (err) {
            next(err);
        }
    },
);

export default router;
