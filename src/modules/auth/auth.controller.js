import asyncHandler from "../../shared/utils/asyncHandler.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";
import * as authService from "./auth.service.js";

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return ApiResponse.send(
    res,
    201,
    "Registration successful. Please verify your phone number.",
    result,
  );
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return ApiResponse.send(res, 200, "Login successful", result);
});
export const adminLogin = asyncHandler(async (req, res) => {
  const result = await authService.adminLogin(req.body);
  return ApiResponse.send(res, 200, "Login successful", result);
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  return ApiResponse.send(res, 200, "Token refreshed", result);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id, req.body.refreshToken);
  return ApiResponse.send(res, 200, "Logged out successfully");
});

export const resendOtp = asyncHandler(async (req, res) => {
  const result = await authService.resendOtp(req.body.phone);
  return ApiResponse.send(res, 200, result.message);
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyPhoneOtp(req.body);
  return ApiResponse.send(res, 200, "Phone verified successfully", result);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  return ApiResponse.send(res, 200, result.message);
});

export const verifyResetOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyResetOtp(req.body);
  return ApiResponse.send(res, 200, "OTP verified successfully", result);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  return ApiResponse.send(res, 200, result.message);
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user._id, req.body);
  return ApiResponse.send(res, 200, result.message);
});

import Driver from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";

export const getMe = asyncHandler(async (req, res) => {
  const userJson = req.user.toSafeJSON();
  if (req.user.role === "driver") {
    const driver = await Driver.findOne({ user: req.user._id });
    if (driver) {
      userJson.driverStatus = driver.status;
    }
  } else if (req.user.role === "office") {
    const office = await Office.findOne({ user: req.user._id });
    if (office) {
      userJson.officeStatus = office.status || "available";
    }
  }
  return ApiResponse.send(res, 200, "Current user", {
    user: userJson,
  });
});
