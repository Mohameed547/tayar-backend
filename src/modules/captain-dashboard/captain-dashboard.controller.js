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
