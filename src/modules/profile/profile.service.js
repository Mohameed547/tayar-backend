import User from "../../database/models/User.model.js";
import ApiError from "../../shared/utils/ApiError.js";

const getProfile = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return user;
};

const updateProfile = async (userId, updateData) => {
  const allowedFields = ["fullName", "phone", "profileImage"];

  const filteredData = {};
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      filteredData[field] = updateData[field];
    }
  }

  const updatedUser = await User.findByIdAndUpdate(userId, filteredData, {
    new: true,
    runValidators: true,
  });

  if (!updatedUser) {
    throw ApiError.notFound("User not found");
  }

  return updatedUser;
};

export { getProfile, updateProfile };
