import revenueService from "./revenue.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

export const getRevenue = async (req, res, next) => {
  try {
    const { period } = req.query;
    const result = await revenueService.getRevenue(period);
    return res.status(200).json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};
