import driverService from "./drivers.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

export const getAllDrivers = async (req, res, next) => {
  try {
    const { status, search, page, limit } = req.query;
    const result = await driverService.getAllDrivers({
      status,
      search,
      page,
      limit,
    });
    return res.status(200).json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const updateDriverStatus = async (req, res, next) => {
  try {
    const result = await driverService.updateDriverStatus(
      req.params.id,
      req.body.status,
    );
    return res
      .status(200)
      .json(ApiResponse.success(result, "Driver status updated"));
  } catch (err) {
    next(err);
  }
};
