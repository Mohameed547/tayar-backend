import usersService from "./users.service.js";
import accountDeletionService from "../auth/account-deletion.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";
import ApiError from "../../shared/utils/ApiError.js";
import { ACCOUNT_STATUS } from "../../shared/constants/accountStatus.js";

// Static import — no per-request module resolution overhead
import { disconnectUser } from "../../config/socket.js";

// ─── Replay-attack guard ──────────────────────────────────────────────────────
// 90-second window (industry standard for destructive operations)
const REPLAY_WINDOW_MS = 90 * 1000;

function assertFreshTimestamp(req) {
  const header = req.headers["x-request-timestamp"];
  if (!header) {
    throw new ApiError(400, "Missing x-request-timestamp header.");
  }
  const ts = Date.parse(header);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
    throw new ApiError(
      400,
      "Request timestamp is invalid or expired (replay protection). Max window: 90 seconds."
    );
  }
}

// ─── Standard profile endpoints ───────────────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const user = await usersService.getProfile(req.user._id);
    return res.status(200).json(ApiResponse.success(user));
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const user = await usersService.updateProfile(req.user._id, req.body);
    return res.status(200).json(ApiResponse.success(user, "Profile updated"));
  } catch (err) {
    next(err);
  }
};

export const addPushToken = async (req, res, next) => {
  try {
    await usersService.registerPushToken(req.user._id, req.body.token);
    return res.status(200).json(ApiResponse.success(null, "Push token registered"));
  } catch (err) {
    next(err);
  }
};

export const removePushToken = async (req, res, next) => {
  try {
    await usersService.removePushToken(req.user._id, req.body.token);
    return res.status(200).json(ApiResponse.success(null, "Push token removed"));
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /users/me ─────────────────────────────────────────────────────────
export const deleteMe = async (req, res, next) => {
  try {
    assertFreshTimestamp(req);

    const { reason } = req.body;
    const userId = req.user._id;

    // 1. Eligibility check (runs all DB queries in parallel internally)
    await accountDeletionService.validateAccountDeletionEligibility(userId, req.user.role);

    // 2. Atomic: schedule deletion + revoke refresh tokens in ONE save
    //    (service returns plain object, not full user doc — avoids leaking tokens)
    const result = await accountDeletionService.scheduleDeletion(userId, reason, userId);

    // 3. Disconnect active WebSocket sessions (fire-and-forget, non-blocking)
    try {
      disconnectUser(userId.toString());
    } catch (socketErr) {
      // Never fail the HTTP response over a socket error
      console.error("[deleteMe] Socket disconnect failed:", socketErr.message);
    }

    // 4. Clear HttpOnly refresh cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return res.status(200).json(
      ApiResponse.success(result, "Account deletion scheduled. You have 30 days to restore it.")
    );
  } catch (err) {
    next(err);
  }
};

// ─── POST /users/me/restore ───────────────────────────────────────────────────
export const restoreMe = async (req, res, next) => {
  try {
    assertFreshTimestamp(req);

    const result = await accountDeletionService.cancelDeletion(req.user._id);
    return res.status(200).json(
      ApiResponse.success(result, "Account deletion cancelled. Your account is restored.")
    );
  } catch (err) {
    next(err);
  }
};

// ─── GET /users/me/delete-status ──────────────────────────────────────────────
export const getDeleteStatus = async (req, res, next) => {
  try {
    const user = req.user; // already loaded by authenticate middleware — no extra DB hit

    let daysRemaining = null;
    if (user.scheduledDeletionDate) {
      const diffMs = new Date(user.scheduledDeletionDate) - Date.now();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return res.status(200).json(
      ApiResponse.success({
        accountStatus:         user.accountStatus,
        isPendingDeletion:     user.accountStatus === ACCOUNT_STATUS.PENDING_DELETION,
        scheduledDeletionDate: user.scheduledDeletionDate ?? null,
        daysRemaining,
        deleteReason:          user.deleteReason ?? null,
      })
    );
  } catch (err) {
    next(err);
  }
};
