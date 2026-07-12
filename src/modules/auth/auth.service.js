import crypto from "crypto";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import User from "../../database/models/User.model.js";
import Driver from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";
import Wallet from "../../database/models/Wallet.model.js";
import ApiError from "../../shared/utils/ApiError.js";
import { issueTokenPair, verifyRefreshToken } from "../../shared/utils/jwt.js";
import {
  generateOtp,
  hashOtp,
  getOtpExpiry,
  verifyOtp as checkOtp,
} from "../../shared/utils/otp.js";
import logger from "../../shared/middleware/logger.js";
import { ENV } from "../../config/env.js";
import { ROLES } from "../../shared/constants/roles.js";
import { ACCOUNT_STATUS } from "../../shared/constants/accountStatus.js";

// ─── Shared lifecycle guard ────────────────────────────────────────────────────
// Centralised: previously duplicated in login, adminLogin, refresh, authenticate
function assertLifecycleAllowed(user) {
  if (user.isDeleted || user.accountStatus === ACCOUNT_STATUS.DELETED) {
    throw ApiError.forbidden("Your account has been permanently deleted.");
  }
  if (
    user.accountStatus === ACCOUNT_STATUS.SUSPENDED ||
    user.status === "suspended" ||
    user.status === "banned"
  ) {
    throw ApiError.forbidden("Your account is suspended. Contact support.");
  }
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: ENV.EMAIL_USER,
    pass: ENV.EMAIL_APP_PASSWORD,
  },
});

export async function register(payload) {
  const {
    fullName,
    email,
    phone,
    password,
    role,
    vehicleType,
    plateNumber,
    businessName,
    licenseNumber,
    officeAddress,
  } = payload;

  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { phone }],
  });
  if (existing) {
    throw ApiError.conflict(
      existing.email === email.toLowerCase()
        ? "Email is already registered"
        : "Phone number is already registered",
    );
  }

  const session = await mongoose.startSession();
  let user;
  try {
    logger.info(`Starting registration transaction for role: ${role}`);
    await session.withTransaction(async () => {
      user = new User({
        fullName,
        email: email.toLowerCase(),
        phone,
        password,
        role,
        status: role === "customer" ? "active" : "pending",
      });
      await user.save({ session });
      logger.info(`Saved User in transaction: ${user._id}`);

      if (role === "driver") {
        logger.info(`Saving Driver in transaction for user: ${user._id}`);
        const driver = new Driver({
          user: user._id,
          vehicle: { type: vehicleType, plateNumber },
        });
        await driver.save({ session });
        logger.info(`Saved Driver in transaction: ${driver._id}`);
        await linkPendingInvitations(driver._id, email, phone);
      } else if (role === "office") {
        logger.info(`Saving Office in transaction for user: ${user._id}`);
        const office = new Office({
          user: user._id,
          businessName,
          licenseNumber,
          address: { text: officeAddress },
        });
        await office.save({ session });
        logger.info(`Saved Office in transaction: ${office._id}`);
      }
    });
  } catch (txError) {
    logger.warn(`Transaction failed: ${txError.message}. Code: ${txError.code}. Checking if standalone fallback is needed.`);
    // Check if it is a transaction/replica set error
    const isStandaloneError = 
      txError.message?.includes("replica set") || 
      txError.message?.includes("Transaction") || 
      txError.code === 20 || 
      txError.codeName === "IllegalOperation";

    if (isStandaloneError) {
      logger.info(`Standalone fallback triggered for role: ${role}`);
      user = new User({
        fullName,
        email: email.toLowerCase(),
        phone,
        password,
        role,
        status: role === "customer" ? "active" : "pending",
      });
      await user.save();
      logger.info(`Saved User in standalone: ${user._id}`);

      if (role === "driver") {
        logger.info(`Saving Driver in standalone for user: ${user._id}`);
        const driver = new Driver({
          user: user._id,
          vehicle: { type: vehicleType, plateNumber },
        });
        await driver.save();
        logger.info(`Saved Driver in standalone: ${driver._id}`);
        await linkPendingInvitations(driver._id, email, phone);
      } else if (role === "office") {
        logger.info(`Saving Office in standalone for user: ${user._id}`);
        const office = new Office({
          user: user._id,
          businessName,
          licenseNumber,
          address: { text: officeAddress },
        });
        await office.save();
        logger.info(`Saved Office in standalone: ${office._id}`);
      }
    } else {
      logger.error(`Non-standalone transaction error: ${txError.message}`);
      throw txError;
    }
  } finally {
    await session.endSession();
  }

  // === التعديل هنا لحل مشكلة الـ Parallel Save ===
  const tokens = issueTokenPair({ id: user._id, role: user.role });
  user.refreshTokens = [tokens.refreshToken];
  await user.save();

  sendEmailOtp(user, "email_verification").catch((err) =>
    logger.error(`Failed to send registration OTP Email: ${err.message}`),
  );
  // ===============================================

  const userJson = user.toSafeJSON();
  if (user.role === "driver") {
    const driver = await Driver.findOne({ user: user._id });
    if (driver) {
      userJson.driverStatus = driver.status;
      userJson.workingMode = driver.workingMode || "independent";
      userJson.activeOfficeId = driver.activeOfficeId || null;
    }
  } else if (user.role === "office") {
    const office = await Office.findOne({ user: user._id });
    if (office) {
      userJson.officeStatus = office.status || "available";
    }
  }
  return { user: userJson, tokens };
}

export async function login({ emailOrPhone, password }) {
  const user = await User.findOne({
    $or: [{ email: emailOrPhone?.toLowerCase() }, { phone: emailOrPhone }],
    isDeleted: { $in: [true, false] },
  }).select("+password +refreshTokens");

  // NOTE: We intentionally check password BEFORE lifecycle status to prevent
  // user enumeration via timing — invalid credentials always reject first.
  // Exception: if no password has been set yet (new captain), we check lifecycle first.
  if (!user) {
    throw ApiError.unauthorized("Invalid credentials.");
  }

  // Handle accounts with no password yet (new captains awaiting onboarding)
  if (!user.password) {
    const lifecycleReason = user.accountStatus || "PENDING_OTP";
    throw Object.assign(
      new ApiError(403, `Account not fully set up. Reason: ${lifecycleReason}`, lifecycleReason),
      { code: lifecycleReason, phone: user.phone, email: user.email }
    );
  }

  if (!(await user.comparePassword(password))) {
    throw ApiError.unauthorized("Invalid credentials.");
  }

  // Now safe to reveal the lifecycle reason
  assertLifecycleAllowed(user);

  // Block login for captains in onboarding pipeline
  const BLOCKED_STATUSES = ["PENDING_OTP", "PENDING_PASSWORD", "PENDING_DOCUMENTS", "PENDING_ADMIN_REVIEW", "REJECTED"];
  if (BLOCKED_STATUSES.includes(user.accountStatus)) {
    throw Object.assign(
      new ApiError(403, `Account access restricted. Status: ${user.accountStatus}`, user.accountStatus),
      { code: user.accountStatus, phone: user.phone, email: user.email }
    );
  }

  const tokens = issueTokenPair({ id: user._id, role: user.role });
  // Cap at 5 concurrent sessions — prevents unbounded array growth
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), tokens.refreshToken];
  user.lastLoginAt   = new Date();
  await user.save();

  const userJsonLogin = user.toSafeJSON();

  // Load role-specific status fields in parallel
  if (user.role === "driver") {
    const driver = await Driver.findOne({ user: user._id }).select("status workingMode activeOfficeId").lean();
    if (driver) {
      userJsonLogin.driverStatus = driver.status;
      userJsonLogin.workingMode = driver.workingMode || "independent";
      userJsonLogin.activeOfficeId = driver.activeOfficeId || null;
    }
  } else if (user.role === "office") {
    const office = await Office.findOne({ user: user._id }).select("status").lean();
    if (office) userJsonLogin.officeStatus = office.status || "available";
  }

  if (user.accountStatus === ACCOUNT_STATUS.PENDING_DELETION) {
    return {
      user: userJsonLogin,
      tokens,
      isPendingDeletion: true,
      message: "Account is pending deletion. You can restore it within 30 days.",
    };
  }

  return { user: userJsonLogin, tokens };
}

export async function adminLogin({ emailOrPhone, password }) {
  const user = await User.findOne({
    $or: [{ email: emailOrPhone?.toLowerCase() }, { phone: emailOrPhone }],
    isDeleted: { $in: [true, false] },
  }).select("+password +refreshTokens");

  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized("Invalid credentials.");
  }
  if (user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden("This account does not have admin access.");
  }

  assertLifecycleAllowed(user);

  const tokens = issueTokenPair({ id: user._id, role: user.role });
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), tokens.refreshToken];
  user.lastLoginAt   = new Date();
  await user.save();

  return { user: user.toSafeJSON(), tokens };
}
export async function refresh(refreshTokenValue) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshTokenValue);
  } catch (_err) {
    throw ApiError.unauthorized("Invalid or expired refresh token.");
  }

  const user = await User.findOne({
    _id: decoded.id,
    isDeleted: { $in: [true, false] },
  }).select("+refreshTokens");

  if (!user || !(user.refreshTokens || []).includes(refreshTokenValue)) {
    // Token rotation: if token not found, it may have been replayed — reject
    throw ApiError.unauthorized("Refresh token has been revoked or already used.");
  }

  assertLifecycleAllowed(user);

  // Rotate: remove old token, issue new pair (prevents refresh token reuse)
  const tokens = issueTokenPair({ id: user._id, role: user.role });
  user.refreshTokens = user.refreshTokens
    .filter((t) => t !== refreshTokenValue)
    .concat(tokens.refreshToken)
    .slice(-5); // Safety cap
  await user.save();

  return { tokens };
}

export async function logout(userId, refreshTokenValue) {
  const user = await User.findById(userId).select("+refreshTokens");
  if (!user) return;
  user.refreshTokens = (user.refreshTokens || []).filter(
    (t) => t !== refreshTokenValue,
  );
  await user.save();
}

export async function sendEmailOtp(user, purpose) {
  const otp = generateOtp();
  user.otpHash = hashOtp(otp);
  user.otpExpires = getOtpExpiry();
  user.otpPurpose = purpose;
  await user.save();

  logger.info(`[Email OTP] Generated OTP for ${user.email} (${purpose}): ${otp}`);

  const mailOptions = {
    from: `"DeliveryHub Support" <${ENV.EMAIL_USER}>`,
    to: user.email,
    subject: "Verification Code - DeliveryHub",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333; text-align: center;">Welcome to DeliveryHub!</h2>
        <p>Hello ${user.fullName},</p>
        <p>Your verification code for <strong>${purpose === "email_verification" ? "Account Activation" : "Login"}</strong> is:</p>
        <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #007bff; margin: 20px 0; border-radius: 5px;">
          ${otp}
        </div>
        <p style="color: #666; font-size: 12px;">This code is valid for a limited time. If you didn't request this, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.info(`[Email OTP] Sent successfully to ${user.email}`);

  return otp;
}

export async function resendOtp(phone) {
  const user = await User.findOne({ phone });
  if (!user) throw ApiError.notFound("No account found with this phone number");
  await sendEmailOtp(
    user,
    user.isPhoneVerified ? "login" : "email_verification",
  );
  return { message: "OTP sent to your registered email" };
}

export async function verifyPhoneOtp({ phone, otp }) {
  const user = await User.findOne({ phone }).select("+otpHash +otpExpires");
  if (!user) throw ApiError.notFound("No account found with this phone number");

  const result = checkOtp(otp, user.otpHash, user.otpExpires);
  if (!result.valid) {
    throw ApiError.badRequest(
      result.reason === "expired" ? "OTP has expired" : "Invalid OTP",
    );
  }

  user.isPhoneVerified = true;
  user.phoneVerifiedAt = new Date();
  if (user.status === "pending" && user.role === "customer")
    user.status = "active";
  user.otpHash = undefined;
  user.otpExpires = undefined;
  user.otpPurpose = undefined;
  await user.save();

  return { user: user.toSafeJSON() };
}

export async function forgotPassword(email) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw ApiError.notFound("No account found with this email address");
  }

  await sendEmailOtp(user, "password_reset");
  return { message: "OTP sent to your registered email" };
}

export async function verifyResetOtp({ email, otp }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+otpHash +otpExpires +otpPurpose");
  if (!user) {
    throw ApiError.notFound("No account found with this email address");
  }

  if (user.otpPurpose !== "password_reset") {
    throw ApiError.badRequest("Invalid OTP purpose");
  }

  const result = checkOtp(otp, user.otpHash, user.otpExpires);
  if (!result.valid) {
    throw ApiError.badRequest(
      result.reason === "expired" ? "OTP has expired" : "Invalid OTP",
    );
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetTokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  user.otpHash = undefined;
  user.otpExpires = undefined;
  user.otpPurpose = undefined;
  await user.save();

  logger.info(`[PasswordReset] OTP verified successfully. Reset token generated: ${rawToken}`);
  return { token: rawToken };
}

export async function resetPassword({ token, newPassword }) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpires +refreshTokens");

  if (!user) throw ApiError.badRequest("Reset token is invalid or has expired");

  user.password = newPassword;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens = [];
  await user.save();

  return { message: "Password reset successful" };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select("+password +refreshTokens");
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest("Current password is incorrect");
  }
  user.password = newPassword;
  user.refreshTokens = [];
  await user.save();
  return { message: "Password changed successfully" };
}

async function linkPendingInvitations(driverId, email, phone) {
  try {
    const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
    const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");
    
    const conditions = [];
    if (email) conditions.push({ inviteeEmail: email.toLowerCase() });
    if (phone) conditions.push({ inviteePhone: phone });
    
    if (conditions.length > 0) {
      await OfficeCaptain.updateMany(
        {
          captainId: null,
          status: OFFICE_CAPTAIN_STATUS.INVITED,
          $or: conditions
        },
        {
          captainId: driverId
        }
      );
      logger.info(`[Invitation Linker] Linked driver ${driverId} to matching pending invitations.`);
    }
  } catch (err) {
    logger.error(`[Invitation Linker ERROR] Failed to link pending invitations: ${err.message}`);
  }
}

// ─── Captain Onboarding Functions ─────────────────────────────────────────────

const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_RESENDS  = 5;
const OTP_EXPIRY_MS    = 5 * 60 * 1000; // 5 minutes

/**
 * Verify OTP for captain activation.
 * On success: accountStatus → PENDING_PASSWORD, isPhoneVerified = true.
 */
export async function verifyCaptainOtp({ phone, otp }) {
  const user = await User.findOne({ phone }).select("+otpHash +otpExpires +otpAttempts +otpPurpose");
  if (!user) throw ApiError.notFound("No account found with this phone number.");

  if (user.accountStatus !== "PENDING_OTP") {
    throw ApiError.badRequest("This account is not awaiting OTP verification.");
  }

  // Enforce attempt limit
  if ((user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
    throw ApiError.badRequest("Too many failed attempts. Please request a new OTP.");
  }

  const result = checkOtp(otp, user.otpHash, user.otpExpires);
  if (!result.valid) {
    user.otpAttempts = (user.otpAttempts || 0) + 1;
    await user.save();
    const attemptsLeft = MAX_OTP_ATTEMPTS - user.otpAttempts;
    throw ApiError.badRequest(
      result.reason === "expired"
        ? "OTP has expired. Please request a new one."
        : `Invalid OTP. ${attemptsLeft} attempt(s) remaining.`
    );
  }

  // OTP valid — advance to password setup stage
  user.isPhoneVerified = true;
  user.phoneVerifiedAt = new Date();
  user.accountStatus   = "PENDING_PASSWORD";
  user.otpHash         = undefined;
  user.otpExpires      = undefined;
  user.otpPurpose      = undefined;
  user.otpAttempts     = 0;
  await user.save();

  logger.info(`[CaptainOTP] Phone ${phone} verified successfully. Advancing to PENDING_PASSWORD.`);
  return { message: "OTP verified. Please set your password.", accountStatus: "PENDING_PASSWORD" };
}

/**
 * Set password for a captain in PENDING_PASSWORD state.
 * On success: accountStatus → PENDING_DOCUMENTS, isActive = true.
 */
export async function setCaptainPassword({ phone, password }) {
  const user = await User.findOne({ phone }).select("+password +refreshTokens");
  if (!user) throw ApiError.notFound("No account found with this phone number.");

  if (user.accountStatus !== "PENDING_PASSWORD") {
    throw ApiError.badRequest("Password setup is not available for this account at this stage.");
  }

  user.password          = password; // pre-save hook will hash it
  user.passwordCreatedAt = new Date();
  user.accountStatus     = "PENDING_DOCUMENTS";
  user.status            = "pending";
  await user.save();

  // Activate driver record
  const Driver = (await import("../../database/models/Driver.js")).default;
  await Driver.findOneAndUpdate({ user: user._id }, { isActive: true });

  // Issue tokens so captain can access the documents upload screen
  const tokens = issueTokenPair({ id: user._id, role: user.role });
  user.refreshTokens = [tokens.refreshToken];
  user.lastLoginAt   = new Date();
  await user.save();

  logger.info(`[CaptainPassword] Password set for ${phone}. Advancing to PENDING_DOCUMENTS.`);
  return {
    user: user.toSafeJSON(),
    tokens,
    accountStatus: "PENDING_DOCUMENTS",
    message: "Password set. Please upload your documents.",
  };
}

/**
 * Resend OTP for captain activation (rate-limited to MAX_OTP_RESENDS).
 */
export async function resendCaptainOtp({ phone }) {
  const user = await User.findOne({ phone }).select("+otpResendCount +otpHash +otpExpires");
  if (!user) throw ApiError.notFound("No account found with this phone number.");

  if (user.accountStatus !== "PENDING_OTP") {
    throw ApiError.badRequest("OTP resend is not applicable for this account.");
  }

  if ((user.otpResendCount || 0) >= MAX_OTP_RESENDS) {
    throw ApiError.badRequest("Maximum OTP resend limit reached. Contact support.");
  }

  user.otpResendCount = (user.otpResendCount || 0) + 1;
  user.otpAttempts    = 0; // reset attempt counter on resend
  await sendEmailOtp(user, "captain_activation");

  logger.info(`[CaptainOTP Resend] OTP resent to ${user.email} (resend #${user.otpResendCount})`);
  return {
    message: "OTP resent to your email.",
    resendsLeft: MAX_OTP_RESENDS - user.otpResendCount,
  };
}

/**
 * Get current onboarding status for a captain (by phone).
 * Used by the frontend to determine which screen to show.
 */
export async function getCaptainOnboardingStatus({ phone }) {
  const user = await User.findOne({ phone }).select("accountStatus isPhoneVerified email role");
  if (!user || user.role !== "driver") throw ApiError.notFound("No captain found with this phone number.");
  return {
    accountStatus: user.accountStatus,
    isPhoneVerified: user.isPhoneVerified,
    email: user.email,
  };
}
