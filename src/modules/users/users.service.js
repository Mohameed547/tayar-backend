import User from "../../database/models/User.model.js";
import ApiError from "../../shared/utils/ApiError.js";

const getProfile = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");
    return user;
};

const updateProfile = async (userId, updateData) => {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    const fullName = updateData.fullName || updateData.name;
    const profileImage = updateData.profileImage || updateData.avatarUrl;
    const phone = updateData.phone;

    if (fullName !== undefined) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;
    if (profileImage !== undefined) user.profileImage = profileImage;

    await user.save();
    return user;
};

const registerPushToken = async (userId, token) => {
    await User.updateOne({ _id: userId }, { $addToSet: { pushTokens: token } });
};

const removePushToken = async (userId, token) => {
    await User.updateOne({ _id: userId }, { $pull: { pushTokens: token } });
};

const getUserRole = async (userId) => {
    const user = await User.findById(userId).select("role");
    if (!user) throw new ApiError(404, "User not found");
    return user.role;
};

export default {
    getProfile,
    updateProfile,
    registerPushToken,
    removePushToken,
    getUserRole,
};
