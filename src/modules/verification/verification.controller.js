import verificationService from "./verification.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

export const uploadDocument = async (req, res, next) => {
    try {
        const verification = await verificationService.uploadDocument(req.user._id, req.body);
        return res
            .status(200)
            .json(ApiResponse.success(verification, "Document uploaded successfully"));
    } catch (err) {
        next(err);
    }
};

export const getStatus = async (req, res, next) => {
    try {
        const status = await verificationService.getStatus(req.user._id);
        return res.status(200).json(ApiResponse.success(status));
    } catch (err) {
        next(err);
    }
};

export const reviewVerification = async (req, res, next) => {
    try {
        const { userId, status, reviewNote } = req.body;
        const verification = await verificationService.reviewVerification(
            req.user._id,
            userId,
            { status, reviewNote },
        );
        return res
            .status(200)
            .json(ApiResponse.success(verification, "Verification reviewed"));
    } catch (err) {
        next(err);
    }
};
