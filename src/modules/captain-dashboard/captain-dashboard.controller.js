import captainDashboardService from "./captain-dashboard.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

// GET /api/captain-dashboard
export const getCaptainDashboard = async (req, res, next) => {
    try {
        const captainId = req.user._id;
        const data = await captainDashboardService.getCaptainDashboard(captainId);

        return res.status(200).json(ApiResponse.success(data));
    } catch (err) {
        next(err);
    }
};

export const getInvitations = async (req, res, next) => {
    try {
        const data = await captainDashboardService.getInvitations(req.user._id);
        return res.status(200).json(ApiResponse.success(data));
    } catch (err) {
        next(err);
    }
};

const getReqMetadata = (req) => ({
    ip: req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress,
    userAgent: req.headers["user-agent"]
});

export const acceptInvitation = async (req, res, next) => {
    try {
        const result = await captainDashboardService.acceptInvitation(req.user._id, req.params.invitationId, getReqMetadata(req));
        return res.status(200).json(ApiResponse.success(result, result.message));
    } catch (err) {
        next(err);
    }
};

export const rejectInvitation = async (req, res, next) => {
    try {
        const result = await captainDashboardService.rejectInvitation(req.user._id, req.params.invitationId, getReqMetadata(req));
        return res.status(200).json(ApiResponse.success(result, result.message));
    } catch (err) {
        next(err);
    }
};

export const getMyOffices = async (req, res, next) => {
    try {
        const result = await captainDashboardService.getMyOffices(req.user._id);
        return res.status(200).json(ApiResponse.success(result));
    } catch (err) {
        next(err);
    }
};

export const leaveOffice = async (req, res, next) => {
    try {
        const result = await captainDashboardService.leaveOffice(req.user._id, req.params.officeId, getReqMetadata(req));
        return res.status(200).json(ApiResponse.success(result, result.message));
    } catch (err) {
        next(err);
    }
};

export const setDefaultOffice = async (req, res, next) => {
    try {
        const result = await captainDashboardService.setDefaultOffice(req.user._id, req.params.officeId);
        return res.status(200).json(ApiResponse.success(result, result.message));
    } catch (err) {
        next(err);
    }
};

export const switchActiveOffice = async (req, res, next) => {
    try {
        const result = await captainDashboardService.switchActiveOffice(req.user._id, req.body.officeId);
        return res.status(200).json(ApiResponse.success(result, result.message));
    } catch (err) {
        next(err);
    }
};

