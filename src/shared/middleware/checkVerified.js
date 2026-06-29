import Verification from "../../database/models/Verification.model.js";
import ApiError from "../utils/ApiError.js";

export const checkVerified = async (req, res, next) => {
    try {
        if (!req.user) {
            return next(ApiError.unauthorized("Authentication required"));
        }

        // Only enforce verification for office and captain (driver) roles
        if (req.user.role === "office" || req.user.role === "driver") {
            const verification = await Verification.findOne({ user: req.user._id });
            if (!verification || verification.status !== "approved") {
                throw ApiError.forbidden("Your account is not verified. Please upload legal documents and wait for admin approval.");
            }
        }

        next();
    } catch (err) {
        next(err);
    }
};
