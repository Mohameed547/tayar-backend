import asyncHandler from "../../shared/utils/asyncHandler.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";
import * as authService from "./auth.service.js";
import { ENV } from "../../config/env.js";
import Driver from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";

// Helper to safely extract cookies in a lightweight manner
function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map(c => c.trim());
  for (const cookie of cookies) {
    const [key, val] = cookie.split("=");
    if (key === name) return decodeURIComponent(val);
  }
  return null;
}

// Helper to configure HttpOnly refresh cookie options
const getCookieOptions = (req) => {
  const isProduction = ENV.NODE_ENV === "production";
  const isSecure = isProduction || req.secure || req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/",
  };
};

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  if (result.tokens && result.tokens.refreshToken) {
    res.cookie("refreshToken", result.tokens.refreshToken, getCookieOptions(req));
  }
  return ApiResponse.send(
    res,
    201,
    "Registration successful. Please verify your phone number.",
    result,
  );
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  if (result.tokens && result.tokens.refreshToken) {
    res.cookie("refreshToken", result.tokens.refreshToken, getCookieOptions(req));
  }
  return ApiResponse.send(res, 200, "Login successful", result);
});

export const adminLogin = asyncHandler(async (req, res) => {
  const result = await authService.adminLogin(req.body);
  if (result.tokens && result.tokens.refreshToken) {
    res.cookie("refreshToken", result.tokens.refreshToken, getCookieOptions(req));
  }
  return ApiResponse.send(res, 200, "Login successful", result);
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken;
  const result = await authService.refresh(token);
  if (result.tokens && result.tokens.refreshToken) {
    res.cookie("refreshToken", result.tokens.refreshToken, getCookieOptions(req));
  }
  return ApiResponse.send(res, 200, "Token refreshed", result);
});

// The production-grade refresh-token endpoint supporting HttpOnly Cookie and Token Rotation
export const refreshTokenEndpoint = asyncHandler(async (req, res) => {
  let token = getCookie(req, "refreshToken") || req.body.refreshToken;
  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "Refresh token is missing",
    });
  }

  const result = await authService.refresh(token);
  if (result.tokens && result.tokens.refreshToken) {
    res.cookie("refreshToken", result.tokens.refreshToken, getCookieOptions(req));
  }
  return ApiResponse.send(res, 200, "Token refreshed successfully", result);
});

export const logout = asyncHandler(async (req, res) => {
  const token = getCookie(req, "refreshToken") || req.body.refreshToken;
  await authService.logout(req.user._id, token);
  
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: ENV.NODE_ENV === "production" || req.secure || req.headers["x-forwarded-proto"] === "https",
    sameSite: "lax",
    path: "/",
  });
  
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
