import Verification from "../../database/models/Verification.model.js";
import ApiError from "../utils/ApiError.js";

export const VERIFICATION_STATUS_ENUM = {
    PENDING_VERIFICATION: "PENDING_VERIFICATION",
    UNDER_REVIEW: "UNDER_REVIEW",
    VERIFIED: "VERIFIED",
    REJECTED: "REJECTED",
    SUSPENDED: "SUSPENDED",
    BLOCKED: "BLOCKED",
};

export const getAccountVerificationStatus = (user, verification) => {
    if (!user) return VERIFICATION_STATUS_ENUM.PENDING_VERIFICATION;
    
    if (user.accountStatus === "SUSPENDED" || user.status === "suspended") {
        return VERIFICATION_STATUS_ENUM.SUSPENDED;
    }
    if (user.status === "banned" || user.accountStatus === "BLOCKED" || user.status === "blocked") {
        return VERIFICATION_STATUS_ENUM.BLOCKED;
    }

    if (user.role === "admin") {
        return VERIFICATION_STATUS_ENUM.VERIFIED;
    }

    if (!verification) {
        return VERIFICATION_STATUS_ENUM.PENDING_VERIFICATION;
    }

    if (verification.status === "approved") {
        return VERIFICATION_STATUS_ENUM.VERIFIED;
    }
    if (verification.status === "rejected") {
        return VERIFICATION_STATUS_ENUM.REJECTED;
    }
    if (verification.status === "pending" || verification.status === "under_review") {
        return verification.documents && verification.documents.length > 0
            ? VERIFICATION_STATUS_ENUM.UNDER_REVIEW
            : VERIFICATION_STATUS_ENUM.PENDING_VERIFICATION;
    }

    return VERIFICATION_STATUS_ENUM.PENDING_VERIFICATION;
};

export const checkVerified = async (req, res, next) => {
    try {
        if (!req.user) {
            return next(ApiError.unauthorized("Authentication required"));
        }

        // 1. Verify Email/Phone is verified (OTP verification)
        if (!req.user.isPhoneVerified) {
            throw ApiError.forbidden("Your email is not verified. Please verify your OTP.");
        }

        // 2. For office and driver, enforce document/KYC verification check
        if (req.user.role === "office" || req.user.role === "driver") {
            const verification = await Verification.findOne({ user: req.user._id });
            const status = getAccountVerificationStatus(req.user, verification);

            if (status === VERIFICATION_STATUS_ENUM.SUSPENDED) {
                throw ApiError.forbidden("Your account is suspended.");
            }
            if (status === VERIFICATION_STATUS_ENUM.BLOCKED) {
                throw ApiError.forbidden("Your account is blocked.");
            }
            if (status !== VERIFICATION_STATUS_ENUM.VERIFIED) {
                throw ApiError.forbidden("Your account is not verified. Please upload legal documents and wait for admin approval.");
            }
        }

        next();
    } catch (err) {
        next(err);
    }
};
