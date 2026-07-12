import officeService from "./office.service.js";
import { sendEmailOtp } from "../auth/auth.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

export const createCaptain = async (req, res, next) => {
    try {
        const result = await officeService.createCaptain(req.user._id, req.body, { sendEmailOtp });
        return res
            .status(201)
            .json(ApiResponse.success(result, "Captain account created. OTP sent to their email."));
    } catch (err) {
        next(err);
    }
};

export const getCaptains = async (req, res, next) => {
    try {
        const { status, page, limit } = req.query;
        const result = await officeService.getCaptains(req.user._id, { status, page, limit });
        return res.status(200).json(ApiResponse.success(result));
    } catch (err) {
        next(err);
    }
};

export const getCaptainById = async (req, res, next) => {
    try {
        const captain = await officeService.getCaptainById(req.user._id, req.params.id);
        return res.status(200).json(ApiResponse.success(captain));
    } catch (err) {
        next(err);
    }
};

export const updateCaptain = async (req, res, next) => {
    try {
        const captain = await officeService.updateCaptain(req.user._id, req.params.id, req.body);
        return res.status(200).json(ApiResponse.success(captain, "Captain updated successfully"));
    } catch (err) {
        next(err);
    }
};

export const deactivateCaptain = async (req, res, next) => {
    try {
        const hardDelete = req.query.hard === "true";
        const removedReason = req.body?.reason || req.body?.removedReason || req.query?.reason || undefined;
        const reqMetadata = {
            ip: req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress,
            userAgent: req.headers["user-agent"]
        };
        const result = await officeService.deactivateCaptain(req.user._id, req.params.id, {
            hardDelete,
            removedReason,
        }, reqMetadata);
        return res
            .status(200)
            .json(ApiResponse.success(result, hardDelete ? "Captain deleted" : "Captain deactivated"));
    } catch (err) {
        next(err);
    }
};

export const suspendCaptain = async (req, res, next) => {
    try {
        const reqMetadata = {
            ip: req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress,
            userAgent: req.headers["user-agent"]
        };
        const reason = req.body?.reason || req.body?.suspendedReason || undefined;
        const captain = await officeService.suspendCaptain(req.user._id, req.params.id, reason, reqMetadata);
        return res.status(200).json(ApiResponse.success(captain, "Captain suspended successfully"));
    } catch (err) {
        next(err);
    }
};

export const unsuspendCaptain = async (req, res, next) => {
    try {
        const reqMetadata = {
            ip: req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress,
            userAgent: req.headers["user-agent"]
        };
        const captain = await officeService.unsuspendCaptain(req.user._id, req.params.id, reqMetadata);
        return res.status(200).json(ApiResponse.success(captain, "Captain unsuspended successfully"));
    } catch (err) {
        next(err);
    }
};

export const updateCaptainStatus = async (req, res, next) => {
    try {
        const captain = await officeService.updateCaptainStatus(
            req.user._id,
            req.params.id,
            req.body.status,
        );
        return res.status(200).json(ApiResponse.success(captain, "Captain status updated"));
    } catch (err) {
        next(err);
    }
};

export const getCaptainTracking = async (req, res, next) => {
    try {
        const tracking = await officeService.getCaptainTracking(req.user._id, req.params.id);
        return res.status(200).json(ApiResponse.success(tracking));
    } catch (err) {
        next(err);
    }
};

export const getCaptainPerformance = async (req, res, next) => {
    try {
        const performance = await officeService.getCaptainPerformance(req.user._id, req.params.id);
        return res.status(200).json(ApiResponse.success(performance));
    } catch (err) {
        next(err);
    }
};

export const getCaptainRatings = async (req, res, next) => {
    try {
        const { page, limit } = req.query;
        const ratings = await officeService.getCaptainRatings(req.user._id, req.params.id, {
            page,
            limit,
        });
        return res.status(200).json(ApiResponse.success(ratings));
    } catch (err) {
        next(err);
    }
};

export const getCaptainOrders = async (req, res, next) => {
    try {
        const { status, page, limit } = req.query;
        const orders = await officeService.getCaptainOrders(req.user._id, req.params.id, {
            status,
            page,
            limit,
        });
        return res.status(200).json(ApiResponse.success(orders));
    } catch (err) {
        next(err);
    }
};

export const getCaptainDeliveries = async (req, res, next) => {
    try {
        const { page, limit } = req.query;
        const deliveries = await officeService.getCaptainDeliveries(req.user._id, req.params.id, {
            page,
            limit,
        });
        return res.status(200).json(ApiResponse.success(deliveries));
    } catch (err) {
        next(err);
    }
};

export const updateOfficeAvailability = async (req, res, next) => {
    try {
        const office = await officeService.updateOfficeAvailability(
            req.user._id,
            req.body.status
        );
        return res.status(200).json(ApiResponse.success(office, "Office status updated"));
    } catch (err) {
        next(err);
    }
};

export const searchCaptain = async (req, res, next) => {
    try {
        const { query } = req.query;
        const result = await officeService.searchCaptain(req.user._id, query);
        return res.status(200).json(ApiResponse.success(result));
    } catch (err) {
        next(err);
    }
};

export const inviteCaptain = async (req, res, next) => {
    try {
        const { email, phone, captainId } = req.body;
        const reqMetadata = {
            ip: req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress,
            userAgent: req.headers["user-agent"]
        };
        const invitation = await officeService.inviteCaptain(req.user._id, { email, phone, captainId }, reqMetadata);
        return res.status(201).json(ApiResponse.success(invitation, "Invitation sent successfully"));
    } catch (err) {
        next(err);
    }
};

export const cancelInvitation = async (req, res, next) => {
    try {
        const { invitationId } = req.params;
        const reqMetadata = {
            ip: req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress,
            userAgent: req.headers["user-agent"]
        };
        const result = await officeService.cancelInvitation(req.user._id, invitationId, reqMetadata);
        return res.status(200).json(ApiResponse.success(result, "Invitation cancelled successfully"));
    } catch (err) {
        next(err);
    }
};

export const getOfficeInvitations = async (req, res, next) => {
    try {
        const { status, page, limit } = req.query;
        const result = await officeService.getOfficeInvitations(req.user._id, { status, page, limit });
        return res.status(200).json(ApiResponse.success(result));
    } catch (err) {
        next(err);
    }
};

