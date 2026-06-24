import officeService from "./office.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

export const createCaptain = async (req, res, next) => {
    try {
        const result = await officeService.createCaptain(req.user._id, req.body);
        return res
            .status(201)
            .json(ApiResponse.success(result, "Captain created successfully"));
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
        const result = await officeService.deactivateCaptain(req.user._id, req.params.id, {
            hardDelete,
        });
        return res
            .status(200)
            .json(ApiResponse.success(result, hardDelete ? "Captain deleted" : "Captain deactivated"));
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
