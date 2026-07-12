import User from "../../database/models/User.model.js";
import Driver from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";
import { Wallet } from "../../database/models/Wallet.model.js";
import Shipment from "../../database/models/Shipment.model.js";
import Offer from "../../database/models/Offer.model.js";
import Support from "../../database/models/Support.model.js";
import ApiError from "../../shared/utils/ApiError.js";
import { SHIPMENT_STATUS } from "../../shared/constants/shipmentStatus.js";
import { ACCOUNT_STATUS } from "../../shared/constants/accountStatus.js";

// ─── Shared guard ─────────────────────────────────────────────────────────────
/**
 * Centralised lifecycle status check — used by multiple services to avoid
 * duplicating the same conditional chain everywhere.
 */
export function assertAccountIsEditable(user) {
  if (user.isDeleted || user.accountStatus === ACCOUNT_STATUS.DELETED) {
    throw new ApiError(403, "This account has been permanently deleted.");
  }
  if (user.accountStatus === ACCOUNT_STATUS.SUSPENDED) {
    throw new ApiError(403, "This account is suspended. Contact support.");
  }
}

// ─── Eligibility check ────────────────────────────────────────────────────────
/**
 * All independent DB queries run in parallel via Promise.all() to minimise
 * latency. Previously they ran sequentially (6 round-trips → now 1 batch).
 *
 * @param {string} userId
 * @param {string} role  customer | driver | office | admin
 */
export async function validateAccountDeletionEligibility(userId, role) {
  if (role === "admin") {
    throw new ApiError(403, "Administrators cannot delete their own accounts.");
  }

  // Run all independent lookups concurrently
  const [user, wallet, driver, office] = await Promise.all([
    User.findById(userId).lean(),
    Wallet.findOne({ userId }).lean(),
    role === "driver"  ? Driver.findOne({ user: userId }).lean()  : Promise.resolve(null),
    role === "office"  ? Office.findOne({ user: userId }).lean()  : Promise.resolve(null),
  ]);

  if (!user) throw new ApiError(404, "User not found.");

  // Wallet check — applies to all roles
  if (wallet && wallet.balance > 0) {
    throw new ApiError(
      400,
      `Cannot delete account: wallet balance is ${wallet.balance.toFixed(2)}. Please withdraw first.`
    );
  }

  if (role === "customer") {
    // Run both checks in parallel
    const [activeShipment, openDispute] = await Promise.all([
      Shipment.findOne({
        customer: userId,
        status: { $nin: [SHIPMENT_STATUS.DELIVERED, SHIPMENT_STATUS.CANCELLED] },
      }).select("trackingNumber").lean(),
      Support.findOne({
        customer: userId,
        status: { $ne: "resolved" },
      }).select("ticketNumber").lean(),
    ]);

    if (activeShipment) {
      throw new ApiError(
        400,
        `Cannot delete account: active shipment #${activeShipment.trackingNumber} is in progress.`
      );
    }
    if (openDispute) {
      throw new ApiError(
        400,
        `Cannot delete account: open dispute ticket #${openDispute.ticketNumber} must be resolved first.`
      );
    }
  }

  if (role === "driver") {
    if (!driver) {
      throw new ApiError(404, "Driver profile not found.");
    }
    if (driver.status !== "offline") {
      throw new ApiError(400, "Cannot delete account: please go offline before deleting your account.");
    }

    const activeDelivery = await Shipment.findOne({
      captain: userId,
      status: { $nin: [SHIPMENT_STATUS.DELIVERED, SHIPMENT_STATUS.CANCELLED] },
    }).select("trackingNumber").lean();

    if (activeDelivery) {
      throw new ApiError(
        400,
        `Cannot delete account: delivery in progress for shipment #${activeDelivery.trackingNumber}.`
      );
    }
  }

  if (role === "office") {
    if (!office) throw new ApiError(404, "Office profile not found.");

    // Run all three office checks in parallel
    const [activeShipment, pendingOffer, assignedCaptainRelation, assignedCaptainLegacy] = await Promise.all([
      Shipment.findOne({
        assignedOffice: office._id,
        status: { $nin: [SHIPMENT_STATUS.DELIVERED, SHIPMENT_STATUS.CANCELLED] },
      }).select("trackingNumber").lean(),
      Offer.findOne({
        offerer: office._id,
        offererType: "Office",
        status: "pending",
      }).select("_id").lean(),
      (async () => {
        const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
        const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");
        return OfficeCaptain.findOne({ officeId: office._id, status: OFFICE_CAPTAIN_STATUS.ACTIVE }).select("_id").lean();
      })(),
      Driver.findOne({ officeId: office._id }).select("_id").lean(),
    ]);

    if (activeShipment) {
      throw new ApiError(
        400,
        `Cannot delete account: office has active shipment #${activeShipment.trackingNumber}.`
      );
    }
    if (pendingOffer) {
      throw new ApiError(400, "Cannot delete account: office has pending shipment offers.");
    }
    if (assignedCaptainRelation || assignedCaptainLegacy) {
      throw new ApiError(400, "Cannot delete account: office still has assigned captains.");
    }
  }
}

// ─── Schedule deletion ────────────────────────────────────────────────────────
/**
 * Atomically sets PENDING_DELETION state AND clears refresh tokens in a single
 * save — eliminates the double-save race condition in the controller.
 *
 * @returns {Object} Updated user doc with scheduledDeletionDate
 */
export async function scheduleDeletion(userId, reason, deletedByUserId = null) {
  const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  const user = await User.findById(userId).select("+refreshTokens");
  if (!user) throw new ApiError(404, "User not found.");

  if (user.accountStatus === ACCOUNT_STATUS.PENDING_DELETION) {
    // Idempotent: already scheduled — return current state without re-saving
    return {
      scheduledDeletionDate: user.scheduledDeletionDate,
      accountStatus:         user.accountStatus,
    };
  }

  // Sanitize reason — strip any HTML tags before persisting
  const safeReason = String(reason).replace(/<[^>]*>/g, "").trim();

  user.accountStatus         = ACCOUNT_STATUS.PENDING_DELETION;
  user.deleteReason          = safeReason;
  user.deletedBy             = deletedByUserId || userId;
  user.scheduledDeletionDate = new Date(Date.now() + GRACE_PERIOD_MS);
  user.refreshTokens         = [];  // ← revoke all sessions atomically

  await user.save();

  return {
    scheduledDeletionDate: user.scheduledDeletionDate,
    accountStatus:         user.accountStatus,
  };
}

// ─── Cancel deletion ──────────────────────────────────────────────────────────
export async function cancelDeletion(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found.");

  if (user.accountStatus !== ACCOUNT_STATUS.PENDING_DELETION) {
    throw new ApiError(400, "Account is not scheduled for deletion.");
  }

  // Grace period enforcement — cannot restore after the window has closed
  if (user.scheduledDeletionDate && new Date() > user.scheduledDeletionDate) {
    throw new ApiError(
      410,
      "The 30-day grace period has expired. Your account can no longer be restored."
    );
  }

  user.accountStatus         = ACCOUNT_STATUS.ACTIVE;
  user.scheduledDeletionDate = null;
  user.deleteReason          = null;
  user.deletedBy             = null;

  await user.save();
  return { accountStatus: user.accountStatus };
}

// ─── Perform soft delete ──────────────────────────────────────────────────────
export async function performSoftDelete(userId, reason, deletedByUserId = null) {
  const safeReason = String(reason || "").replace(/<[^>]*>/g, "").trim();

  const user = await User.findById(userId).select("+refreshTokens");
  if (!user) throw new ApiError(404, "User not found.");

  user.isDeleted             = true;
  user.accountStatus         = ACCOUNT_STATUS.DELETED;
  user.deletedAt             = new Date();
  user.deleteReason          = safeReason;
  user.deletedBy             = deletedByUserId || userId;
  user.scheduledDeletionDate = null;
  user.refreshTokens         = [];  // ensure all sessions revoked on finalization too

  await user.save();
  return user;
}

// ─── Suspend account ──────────────────────────────────────────────────────────
export async function suspendAccount(userId, reason) {
  const safeReason = String(reason || "").replace(/<[^>]*>/g, "").trim();

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found.");

  assertAccountIsEditable(user); // cannot re-suspend a deleted account

  user.accountStatus  = ACCOUNT_STATUS.SUSPENDED;
  user.status         = "suspended"; // keep legacy field in sync
  // NOTE: Use suspensionReason field — not deleteReason — to avoid semantic confusion
  // deleteReason is only for deletion requests; suspension reason stored separately
  user.suspensionReason = safeReason;

  await user.save();
  return user;
}

// ─── Reactivate account ───────────────────────────────────────────────────────
export async function reactivateAccount(userId) {
  const user = await User.findOne({ _id: userId, isDeleted: { $in: [true, false] } });
  if (!user) throw new ApiError(404, "User not found.");

  user.isDeleted             = false;
  user.accountStatus         = ACCOUNT_STATUS.ACTIVE;
  user.status                = "active";
  user.deletedAt             = null;
  user.deletedBy             = null;
  user.deleteReason          = null;
  user.scheduledDeletionDate = null;

  await user.save();
  return user;
}

export default {
  assertAccountIsEditable,
  validateAccountDeletionEligibility,
  scheduleDeletion,
  cancelDeletion,
  performSoftDelete,
  suspendAccount,
  reactivateAccount,
};
