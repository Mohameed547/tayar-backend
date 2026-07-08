import trackingService from "./tracking.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";
// import { getIO } from "../../config/socket.js";

export const getTracking = async (req, res, next) => {
    try {
        const { shipmentId } = req.params;
        const tracking = await trackingService.getTrackingByShipmentId(shipmentId);
        return res.status(200).json(ApiResponse.success(tracking));
    } catch (err) {
        next(err);
    }
};

export const postLocationPing = async (req, res, next) => {
    try {
        const captainId = req.user._id;
        const { shipmentId } = req.params;
        const { lng, lat } = req.body;

        const tracking = await trackingService.recordLocationPing(shipmentId, captainId, {
            lng,
            lat,
        });

        // try {
        //     getIO()
        //         .to(`shipment:${shipmentId}`)
        //         .emit("locationUpdate", {
        //             shipmentId,
        //             coords: tracking.currentLocation?.coords,
        //             progressPercent: tracking.progressPercent,
        //             updatedAt: tracking.currentLocation?.updatedAt,
        //         });
        // } catch {
        //     // Socket layer may not be initialized (e.g. in tests); REST response still succeeds.
        // }

        return res.status(200).json(ApiResponse.success(tracking, "Location updated"));
    } catch (err) {
        next(err);
    }
};

export const postStatusUpdate = async (req, res, next) => {
    try {
        const captainId = req.user._id;
        const { shipmentId } = req.params;
        const { status, note, otpCode, recipientName, signatureImage, packageImage, lat, lng } = req.body;

        const tracking = await trackingService.updateStatus(shipmentId, captainId, {
            status,
            note,
            otpCode,
            recipientName,
            signatureImage,
            packageImage,
            lat,
            lng,
        });

        return res.status(200).json(ApiResponse.success(tracking, "Status updated"));
    } catch (err) {
        next(err);
    }
};

export const postGenerateOTP = async (req, res, next) => {
    try {
        const { shipmentId } = req.params;
        const result = await trackingService.generateNewOTP(shipmentId);
        return res.status(200).json(ApiResponse.success(result, "OTP generated successfully"));
    } catch (err) {
        next(err);
    }
};

export const postVerifyOTP = async (req, res, next) => {
    try {
        const { shipmentId } = req.params;
        const { otpCode } = req.body;
        const result = await trackingService.verifyOTP(shipmentId, otpCode);
        return res.status(200).json(ApiResponse.success(result, "OTP verified successfully"));
    } catch (err) {
        next(err);
    }
};
