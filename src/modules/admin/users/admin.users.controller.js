import adminUsersService from "./admin.users.service.js";
import ApiResponse from "../../../shared/utils/ApiResponse.js";

export const getUsers = async (req, res, next) => {
  try {
    const { search, page, limit } = req.query;
    const result = await adminUsersService.getUsers({
      search,
      page,
      limit,
    });
    return res.status(200).json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await adminUsersService.getUserById(req.params.id);
    return res.status(200).json(ApiResponse.success(user));
  } catch (err) {
    next(err);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const user = await adminUsersService.updateUserStatus(
      req.params.id,
      req.body.status,
    );
    return res
      .status(200)
      .json(ApiResponse.success(user, "User status updated"));
  } catch (err) {
    next(err);
  }
};
