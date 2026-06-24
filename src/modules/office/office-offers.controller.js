import officeOffersService from "./office-offers.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

export const getPendingOffers = async (req, res, next) => {
    try {
        const offers = await officeOffersService.getPendingOffers(req.user._id);
        return res.status(200).json(ApiResponse.success(offers));
    } catch (err) {
        next(err);
    }
};

export const getAssignedOffers = async (req, res, next) => {
    try {
        const offers = await officeOffersService.getAssignedOffers(req.user._id);
        return res.status(200).json(ApiResponse.success(offers));
    } catch (err) {
        next(err);
    }
};

export const assignOffer = async (req, res, next) => {
    try {
        const result = await officeOffersService.assignToCaptain(
            req.user._id,
            req.params.offerId,
            req.params.captainId,
        );
        return res.status(200).json(ApiResponse.success(result, "Shipment assigned to captain"));
    } catch (err) {
        next(err);
    }
};

export const reassignOffer = async (req, res, next) => {
    try {
        const result = await officeOffersService.reassignToCaptain(
            req.user._id,
            req.params.offerId,
            req.params.captainId,
        );
        return res.status(200).json(ApiResponse.success(result, "Shipment reassigned to captain"));
    } catch (err) {
        next(err);
    }
};

export const rejectOffer = async (req, res, next) => {
    try {
        const result = await officeOffersService.rejectOffer(req.user._id, req.params.offerId);
        return res.status(200).json(ApiResponse.success(result, "Offer rejected"));
    } catch (err) {
        next(err);
    }
};

export const getDashboard = async (req, res, next) => {
    try {
        const dashboard = await officeOffersService.getDashboard(req.user._id);
        return res.status(200).json(ApiResponse.success(dashboard));
    } catch (err) {
        next(err);
    }
};
