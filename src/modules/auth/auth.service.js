// TODO: src/modules/auth/auth.service.js — لسه فاضي، هنملاه مع بعض
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
  }).select("+password +refreshTokens");

  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized("Invalid credentials");
  }
  if (user.status === "suspended" || user.status === "banned") {
    throw ApiError.forbidden(
      `Your account is ${user.status}. Contact support.`,
    );
  }

  const tokens = issueTokenPair({ id: user._id, role: user.role });
  user.refreshTokens = [
    ...(user.refreshTokens || []).slice(-4),
    tokens.refreshToken,
  ];
  user.lastLoginAt = new Date();
  await user.save();

  const userJsonLogin = user.toSafeJSON();
  if (user.role === "driver") {
    const driver = await Driver.findOne({ user: user._id });
    if (driver) {
      userJsonLogin.driverStatus = driver.status;
    }
  } else if (user.role === "office") {
    const office = await Office.findOne({ user: user._id });
    if (office) {
      userJsonLogin.officeStatus = office.status || "available";
    }
  }

  return { user: userJsonLogin, tokens };
}

export async function adminLogin({ emailOrPhone, password }) {
  const user = await User.findOne({
    $or: [{ email: emailOrPhone?.toLowerCase() }, { phone: emailOrPhone }],
  }).select("+password +refreshTokens");

  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized("Invalid credentials");
  }
  if (user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden("This account does not have admin access");
  }
  if (user.status === "suspended" || user.status === "banned") {
    throw ApiError.forbidden(
      `Your account is ${user.status}. Contact support.`,
    );
  }

  const tokens = issueTokenPair({ id: user._id, role: user.role });
  user.refreshTokens = [
    ...(user.refreshTokens || []).slice(-4),
    tokens.refreshToken,
  ];
  user.lastLoginAt = new Date();
  await user.save();

  return { user: user.toSafeJSON(), tokens };
}
export async function refresh(refreshTokenValue) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshTokenValue);
  } catch (_err) {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const user = await User.findById(decoded.id).select("+refreshTokens");
  if (!user || !(user.refreshTokens || []).includes(refreshTokenValue)) {
    throw ApiError.unauthorized("Refresh token has been revoked");
  }

  const tokens = issueTokenPair({ id: user._id, role: user.role });
  user.refreshTokens = user.refreshTokens
    .filter((t) => t !== refreshTokenValue)
    .concat(tokens.refreshToken);
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
    return { message: "If an account exists, a reset link has been sent" };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetTokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  logger.info(
    `[PasswordReset] token for ${user.email}: ${rawToken} (would be emailed in production)`,
  );
  return { message: "If an account exists, a reset link has been sent" };
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
