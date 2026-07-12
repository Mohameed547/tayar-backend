import ApiError from "../utils/ApiError.js";
import Driver from "../../database/models/Driver.js";

export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ApiError(401, "Not authenticated"));
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new ApiError(403, "You do not have permission to perform this action"));
        }
        return next();
    };
};

export const checkIndependentMode = async (req, res, next) => {
    if (!req.user) {
        return next(new ApiError(401, "Not authenticated"));
    }
    if (req.user.role === "driver") {
        const driver = await Driver.findOne({ user: req.user._id });
        if (driver && driver.workingMode === "office") {
            const err = new ApiError(403, "You are currently working with an Office. Switch to Independent mode to access Marketplace.");
            err.errorCode = "OFFICE_MODE_ACTIVE";
            return next(err);
        }
    }
    next();
};

export const checkOfficeMode = async (req, res, next) => {
    if (!req.user) {
        return next(new ApiError(401, "Not authenticated"));
    }
    if (req.user.role === "driver") {
        const driver = await Driver.findOne({ user: req.user._id });
        if (!driver || driver.workingMode !== "office") {
            return next(new ApiError(403, "You must be in Office mode to perform this action."));
        }
    }
    next();
};
