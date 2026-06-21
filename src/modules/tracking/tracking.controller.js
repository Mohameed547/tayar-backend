import trackingService from "./tracking.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

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

        return res.status(200).json(ApiResponse.success(tracking, "Location updated"));
    } catch (err) {
        next(err);
    }
};

export const postStatusUpdate = async (req, res, next) => {
    try {
        const captainId = req.user._id;
        const { shipmentId } = req.params;
        const { status, note } = req.body;

        const tracking = await trackingService.updateStatus(shipmentId, captainId, {
            status,
            note,
        });

        return res.status(200).json(ApiResponse.success(tracking, "Status updated"));
    } catch (err) {
        next(err);
    }
};
