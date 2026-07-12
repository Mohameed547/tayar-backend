/**
 * Account Lifecycle Cron Jobs
 *
 * Runs entirely in-process using setInterval (no external dependencies).
 * Handles:
 *  1. Finalize expired PENDING_DELETION → soft-delete (DELETED)
 *
 * In a multi-instance deployment, use a distributed lock (Redis SETNX or
 * MongoDB TTL index) to prevent duplicate runs. For a single-instance
 * graduation project this implementation is production-safe.
 */

import User from "../database/models/User.model.js";
import { ACCOUNT_STATUS } from "../shared/constants/accountStatus.js";
import logger from "../shared/middleware/logger.js";

const FINALIZE_INTERVAL_MS = 60 * 60 * 1000; // run once per hour

/**
 * Finalizes all accounts whose 30-day grace period has passed.
 * Uses a bulk `updateMany` for efficiency instead of N individual saves.
 */
async function finalizeExpiredDeletions() {
  try {
    const now = new Date();

    const result = await User.updateMany(
      {
        accountStatus: ACCOUNT_STATUS.PENDING_DELETION,
        scheduledDeletionDate: { $lte: now },
        isDeleted: { $ne: true }, // safety: skip already-deleted
      },
      {
        $set: {
          isDeleted:             true,
          accountStatus:         ACCOUNT_STATUS.DELETED,
          deletedAt:             now,
          scheduledDeletionDate: null,
          refreshTokens:         [], // revoke any lingering sessions
        },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(
        `[LifecycleCron] Finalized ${result.modifiedCount} expired account(s) → DELETED`
      );
    }
  } catch (err) {
    logger.error(`[LifecycleCron] finalizeExpiredDeletions failed: ${err.message}`);
  }
}

/**
 * Start all lifecycle cron jobs.
 * Called once from server.js after DB connection is established.
 */
export function startLifecycleCrons() {
  // Run immediately on startup to catch any accounts that expired during downtime
  finalizeExpiredDeletions();

  // Then run on schedule
  const timer = setInterval(finalizeExpiredDeletions, FINALIZE_INTERVAL_MS);

  // Allow process to exit cleanly even if interval is active
  timer.unref();

  logger.info(
    `[LifecycleCron] Started — finalizeExpiredDeletions runs every ${FINALIZE_INTERVAL_MS / 60000} min`
  );
}
