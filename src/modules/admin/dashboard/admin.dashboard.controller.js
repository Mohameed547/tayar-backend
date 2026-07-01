import adminDashboardService from "./admin.dashboard.service.js";
import ApiResponse from "../../../shared/utils/ApiResponse.js";

export const getDashboardData = async (req, res, next) => {
  try {
    const result = await adminDashboardService.getDashboardData();
    return res.status(200).json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};
