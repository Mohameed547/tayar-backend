import adminOfficesService from "./admin.offices.service.js";
import ApiResponse from "../../../shared/utils/ApiResponse.js";

export const getOffices = async (req, res, next) => {
    try {
        const { search, status, page, limit } = req.query;
        const result = await adminOfficesService.getOffices({
            search,
            status,
            page,
            limit,
        });
        return res.status(200).json(ApiResponse.success(result));
    } catch (err) {
        next(err);
    }
};

export const getOfficeById = async (req, res, next) => {
    try {
        const office = await adminOfficesService.getOfficeById(req.params.id);
        return res.status(200).json(ApiResponse.success(office));
    } catch (err) {
        next(err);
    }
};

export const updateOfficeStatus = async (req, res, next) => {
    try {
        const result = await adminOfficesService.updateOfficeStatus(
            req.params.id,
            req.body.status,
        );
        return res
            .status(200)
            .json(ApiResponse.success(result, "Office status updated"));
    } catch (err) {
        next(err);
    }
};
