import { Router } from "express";
import earningsService from "./earnings.service.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authorize } from "../../shared/middleware/authorize.js";
import { ROLES } from "../../shared/constants/roles.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

import { checkVerified } from "../../shared/middleware/checkVerified.js";

const router = Router();

router.get(
    "/captain/earnings",
    authenticate,
    authorize(ROLES.CAPTAIN),
    checkVerified,
    async (req, res, next) => {
        try {
            const earnings = await earningsService.getCaptainEarnings(req.user._id);
            return res.status(200).json(ApiResponse.success(earnings));
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/office/earnings",
    authenticate,
    authorize(ROLES.OFFICE),
    checkVerified,
    async (req, res, next) => {
        try {
            const earnings = await earningsService.getOfficeEarnings(req.user._id);
            return res.status(200).json(ApiResponse.success(earnings));
        } catch (err) {
            next(err);
        }
    },
);

export default router;
