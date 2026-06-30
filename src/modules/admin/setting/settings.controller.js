import settingsService from "./settings.service.js";
import ApiResponse from "../../../shared/utils/ApiResponse.js";

const getSettings = async (req, res, next) => {
  try {
    const adminId = req.user._id;
    const settings = await settingsService.getSettings(adminId);
    return ApiResponse.send(
      res,
      200,
      "Settings fetched successfully",
      settings,
    );
  } catch (err) {
    next(err);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const adminId = req.user._id;
    const settings = await settingsService.updateSettings(adminId, req.body);
    return ApiResponse.send(
      res,
      200,
      "Settings updated successfully",
      settings,
    );
  } catch (err) {
    next(err);
  }
};

// ── Admin accounts ─────────────────────────────────────────────────────────

const listAdmins = async (req, res, next) => {
  try {
    const admins = await settingsService.listAdmins();
    return ApiResponse.send(res, 200, "Admins fetched successfully", admins);
  } catch (err) {
    next(err);
  }
};

const removeAdmin = async (req, res, next) => {
  try {
    const currentAdminId = req.user._id;
    const { id: targetAdminId } = req.params;
    const admin = await settingsService.removeAdmin(
      currentAdminId,
      targetAdminId,
    );
    return ApiResponse.send(res, 200, "Admin removed successfully", admin);
  } catch (err) {
    next(err);
  }
};

export default {
  getSettings,
  updateSettings,
  listAdmins,
  removeAdmin,
};
