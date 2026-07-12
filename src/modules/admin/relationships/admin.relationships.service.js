import Office from "../../../database/models/Office.js";
import OfficeCaptain from "../../../database/models/OfficeCaptain.js";
import Driver from "../../../database/models/Driver.js";
import AuditLog from "../../../database/models/AuditLog.model.js";

const getOffices = async () => {
  const offices = await Office.find()
    .populate("user", "fullName email phone status")
    .lean();

  const resolved = await Promise.all(
    offices.map(async (office) => {
      const relations = await OfficeCaptain.find({ officeId: office._id })
        .populate({
          path: "captainId",
          populate: { path: "user", select: "fullName email phone" },
        })
        .lean();
      return {
        ...office,
        relations,
      };
    })
  );
  return resolved;
};

const getCaptains = async () => {
  const captains = await Driver.find()
    .populate("user", "fullName email phone status")
    .lean();

  const resolved = await Promise.all(
    captains.map(async (captain) => {
      const relations = await OfficeCaptain.find({ captainId: captain._id })
        .populate({
          path: "officeId",
          select: "businessName",
        })
        .lean();
      return {
        ...captain,
        relations,
      };
    })
  );
  return resolved;
};

const getRelationships = async (filterStatus) => {
  const query = {};
  if (filterStatus) {
    query.status = filterStatus;
  }
  return await OfficeCaptain.find(query)
    .populate({
      path: "officeId",
      select: "businessName",
      populate: { path: "user", select: "email phone" },
    })
    .populate({
      path: "captainId",
      populate: { path: "user", select: "fullName email phone" },
    })
    .sort({ createdAt: -1 })
    .lean();
};

const getRemovedCaptains = async () => {
  const { OFFICE_CAPTAIN_STATUS } = await import("../../../shared/constants/officeCaptainStatus.js");
  return await OfficeCaptain.find({
    status: { $in: [OFFICE_CAPTAIN_STATUS.LEFT, OFFICE_CAPTAIN_STATUS.REMOVED] },
  })
    .populate({
      path: "officeId",
      select: "businessName",
      populate: { path: "user", select: "email phone" },
    })
    .populate({
      path: "captainId",
      populate: { path: "user", select: "fullName email phone" },
    })
    .sort({ updatedAt: -1 })
    .lean();
};

const getSuspendedCaptains = async () => {
  const { OFFICE_CAPTAIN_STATUS } = await import("../../../shared/constants/officeCaptainStatus.js");
  return await OfficeCaptain.find({
    status: OFFICE_CAPTAIN_STATUS.SUSPENDED,
  })
    .populate({
      path: "officeId",
      select: "businessName",
      populate: { path: "user", select: "email phone" },
    })
    .populate({
      path: "captainId",
      populate: { path: "user", select: "fullName email phone" },
    })
    .sort({ updatedAt: -1 })
    .lean();
};

const getInvitationHistory = async () => {
  const { OFFICE_CAPTAIN_STATUS } = await import("../../../shared/constants/officeCaptainStatus.js");
  return await OfficeCaptain.find({
    status: { $in: [OFFICE_CAPTAIN_STATUS.INVITED, OFFICE_CAPTAIN_STATUS.REJECTED] },
  })
    .populate({
      path: "officeId",
      select: "businessName",
      populate: { path: "user", select: "email phone" },
    })
    .populate({
      path: "captainId",
      populate: { path: "user", select: "fullName email phone" },
    })
    .sort({ createdAt: -1 })
    .lean();
};

const getAuditLogs = async () => {
  return await AuditLog.find()
    .populate({
      path: "officeId",
      select: "businessName",
    })
    .populate({
      path: "captainId",
      populate: { path: "user", select: "fullName email phone" },
    })
    .sort({ timestamp: -1 })
    .lean();
};

export default {
  getOffices,
  getCaptains,
  getRelationships,
  getRemovedCaptains,
  getSuspendedCaptains,
  getInvitationHistory,
  getAuditLogs,
};
