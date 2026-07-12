import mongoose from "mongoose";
import Driver from "../models/Driver.js";
import OfficeCaptain from "../models/OfficeCaptain.js";
import { OFFICE_CAPTAIN_STATUS } from "../../shared/constants/officeCaptainStatus.js";
import logger from "../../shared/middleware/logger.js";

export const migrateLegacyOfficeCaptains = async () => {
  try {
    logger.info("[Migration] Checking for legacy Driver officeId records...");

    // Find all drivers that have an officeId set
    const legacyDrivers = await Driver.find({ officeId: { $ne: null } })
      .select("officeId createdAt")
      .lean();

    if (legacyDrivers.length === 0) {
      logger.info("[Migration] No legacy office-captain connections found.");
      return;
    }

    // Find all existing relationships in OfficeCaptain to prevent duplicates
    const existingRelations = await OfficeCaptain.find()
      .select("officeId captainId")
      .lean();

    const existingKeys = new Set(
      existingRelations.map(
        (r) => `${r.officeId.toString()}-${r.captainId.toString()}`
      )
    );

    const newRelations = [];
    for (const driver of legacyDrivers) {
      const key = `${driver.officeId.toString()}-${driver._id.toString()}`;
      if (!existingKeys.has(key)) {
        newRelations.push({
          officeId: driver.officeId,
          captainId: driver._id,
          status: OFFICE_CAPTAIN_STATUS.ACTIVE,
          joinedAt: driver.createdAt || new Date(),
          isDefaultOffice: true,
        });
      }
    }

    if (newRelations.length > 0) {
      await OfficeCaptain.insertMany(newRelations, { ordered: false });
      logger.info(
        `[Migration] Successfully migrated ${newRelations.length} legacy Driver-Office connections to OfficeCaptain relationship model.`
      );
    } else {
      logger.info(
        "[Migration] All legacy Driver-Office connections already present in OfficeCaptain model."
      );
    }
  } catch (err) {
    logger.error(`[Migration ERROR] Failed to run office-captain migration: ${err.message}`);
  }
};
