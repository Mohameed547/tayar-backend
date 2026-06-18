import * as profileService from "./profile.service.js";

const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await profileService.getProfile(userId);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const updateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updatedUser = await profileService.updateProfile(userId, req.body);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
export { getMyProfile, updateMyProfile };
