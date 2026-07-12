import jwt from "jsonwebtoken";
import { ENV } from "../../config/env.js";
import ApiError from "../utils/ApiError.js";
import User from "../../database/models/User.model.js";
import { ACCOUNT_STATUS } from "../constants/accountStatus.js";

// Routes accessible while account is PENDING_DELETION
const PENDING_DELETION_WHITELIST = [
  "/users/me/restore",
  "/users/me/delete-status",
];

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Access denied. No token provided."));
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, ENV.JWT_SECRET);
  } catch (jwtErr) {
    // Surface the actual JWT error category, not a generic one
    if (jwtErr.name === "TokenExpiredError") {
      return next(ApiError.unauthorized("Token has expired."));
    }
    return next(ApiError.unauthorized("Token is invalid."));
  }

  // Fetch only the lifecycle fields needed — not the full user document
  let user;
  try {
    user = await User.findOne(
      { _id: decoded.id, isDeleted: { $in: [true, false] } },
      "role status accountStatus isDeleted deletedAt deleteReason scheduledDeletionDate email phone fullName isPhoneVerified profileImage createdAt"
    ).lean();
  } catch (dbErr) {
    // DB errors must NOT be swallowed as 401 — they are 500s
    return next(dbErr);
  }

  if (!user) {
    return next(ApiError.unauthorized("User account not found."));
  }

  // ── Lifecycle gate ────────────────────────────────────────────────────────
  if (user.isDeleted || user.accountStatus === ACCOUNT_STATUS.DELETED) {
    return next(ApiError.unauthorized("This account has been permanently deleted."));
  }

  if (
    user.accountStatus === ACCOUNT_STATUS.SUSPENDED ||
    user.status === "suspended" ||
    user.status === "banned"
  ) {
    return next(ApiError.forbidden("Your account is suspended. Please contact support."));
  }

  // Allow PENDING_DELETION users access to restore + status endpoints only
  const isPendingDeletion = user.accountStatus === ACCOUNT_STATUS.PENDING_DELETION;
  if (isPendingDeletion) {
    const isWhitelisted = PENDING_DELETION_WHITELIST.some((path) =>
      req.originalUrl.includes(path)
    );
    if (!isWhitelisted) {
      return next(
        ApiError.forbidden(
          "Your account is scheduled for deletion. Please restore it first."
        )
      );
    }
  }

  // Attach to req — subsequent handlers can use req.user without another DB call
  req.user = user;
  // Re-attach _id in ObjectId form for downstream compatibility
  req.user._id = user._id;
  // Re-attach id as string to preserve compatibility with lean mongoose objects
  req.user.id = user._id.toString();

  next();
};
