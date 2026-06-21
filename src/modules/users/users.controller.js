import usersService from "./users.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

export const getMe = async (req, res, next) => {
    try {
        const user = await usersService.getProfile(req.user._id);
        return res.status(200).json(ApiResponse.success(user));
    } catch (err) {
        next(err);
    }
};

export const updateMe = async (req, res, next) => {
    try {
        const user = await usersService.updateProfile(req.user._id, req.body);
        return res.status(200).json(ApiResponse.success(user, "Profile updated"));
    } catch (err) {
        next(err);
    }
};

export const addPushToken = async (req, res, next) => {
    try {
        await usersService.registerPushToken(req.user._id, req.body.token);
        return res.status(200).json(ApiResponse.success(null, "Push token registered"));
    } catch (err) {
        next(err);
    }
};

export const removePushToken = async (req, res, next) => {
    try {
        await usersService.removePushToken(req.user._id, req.body.token);
        return res.status(200).json(ApiResponse.success(null, "Push token removed"));
    } catch (err) {
        next(err);
    }
};
