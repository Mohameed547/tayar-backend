import express from "express";
import * as controller from "./auth.controller.js";
import validate from "../../shared/middleware/validate.js";
import * as schemas from "./auth.validation.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import { authLimiter } from "../../shared/middleware/rateLimiter.js";

const router = express.Router();

router.post(
  "/register",
  authLimiter,
  validate(schemas.register),
  controller.register,
);
router.post("/login", authLimiter, validate(schemas.login), controller.login);
router.post("/refresh", validate(schemas.refreshToken), controller.refresh);
router.post("/refresh-token", validate(schemas.refreshToken), controller.refreshTokenEndpoint);
router.post(
  "/logout",
  authenticate,
  validate(schemas.refreshToken),
  controller.logout,
);

router.post(
  "/otp/resend",
  authLimiter,
  validate(schemas.resendOtp),
  controller.resendOtp,
);
router.post(
  "/otp/verify",
  authLimiter,
  validate(schemas.verifyOtp),
  controller.verifyOtp,
);

router.post(
  "/forgot-password",
  authLimiter,
  validate(schemas.forgotPassword),
  controller.forgotPassword,
);
router.post(
  "/verify-reset-otp",
  authLimiter,
  validate(schemas.verifyResetOtp),
  controller.verifyResetOtp,
);
router.post(
  "/reset-password",
  authLimiter,
  validate(schemas.resetPassword),
  controller.resetPassword,
);
router.post(
  "/change-password",
  authenticate,
  validate(schemas.changePassword),
  controller.changePassword,
);

router.get("/me", authenticate, controller.getMe);
router.post(
  "/admin/login",
  authLimiter,
  validate(schemas.login),
  controller.adminLogin,
);

// ─── Captain Onboarding Routes ─────────────────────────────────────────────────
router.post("/captain/verify-otp",   authLimiter, controller.verifyCaptainOtp);
router.post("/captain/set-password", authLimiter, controller.setCaptainPassword);
router.post("/captain/resend-otp",   authLimiter, controller.resendCaptainOtp);
router.post("/captain/onboarding-status", controller.getCaptainOnboardingStatus);

export default router;
