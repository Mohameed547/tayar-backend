import Shipment from "../../database/models/Shipment.model.js";
import { SHIPMENT_STATUS } from "../../shared/constants/shipmentStatus.js";

// NOTE: Wallet model is intentionally NOT imported here yet.
// See getTodayEarnings() below for why.

/**
 * "Incoming Requests" for the captain Overview screen: shipments still
 * waiting for an offer, visible to every captain (no geo/zone filtering —
 * confirmed explicitly, not an oversight). Excludes shipments that already
 * have a captain assigned.
 *
 * Returns the shape the frontend's ShipmentRequest type expects:
 *   { id, route, weight, packageType, expiresIn, pickup, dropoff }
 */
const getIncomingRequests = async (driver) => {
  if (driver.officeId) {
    // Office Captain: only show assignments from the current active office that are pending their accept/reject
    const shipments = await Shipment.find({
      assignedOffice: driver.officeId,
      captain: driver.user,
      captainStatus: "pending"
    })
      .sort({ createdAt: -1 })
      .limit(20);

    return shipments.map((s) => ({
      id: s.trackingNumber,
      route: `${s.pickupAddress} -> ${s.deliveryAddress}`,
      weight: `${s.weight} kg`,
      packageType: s.packageType,
      expiresIn: "",
      pickup: s.pickupAddress,
      dropoff: s.deliveryAddress,
      price: s.captainPrice || s.price,
      isOfficeAssignment: true,
      shipmentId: s._id,
    }));
  } else {
    // Independent Captain: show general marketplace shipments (status = pending_offers, no captain, no assigned office)
    const shipments = await Shipment.find({
      status: SHIPMENT_STATUS.PENDING_OFFERS,
      captain: null,
      assignedOffice: null
    })
      .sort({ createdAt: -1 })
      .limit(20);

    return shipments.map((s) => ({
      id: s.trackingNumber,
      route: `${s.pickupAddress} -> ${s.deliveryAddress}`,
      weight: `${s.weight} kg`,
      packageType: s.packageType,
      expiresIn: "",
      pickup: s.pickupAddress,
      dropoff: s.deliveryAddress,
      price: s.price,
      isOfficeAssignment: false,
      shipmentId: s._id,
    }));
  }
};

/**
 * "Today's Earnings" metric for the Overview screen.
 *
 * IMPORTANT: there is currently no transaction type in Wallet.model.js
 * that represents "captain got paid for a delivery" (only topup, payment,
 * cashback exist). Summing those would produce a number that LOOKS real
 * but means something else entirely (e.g. counts the captain topping up
 * their own wallet as "earnings"). Returning 0 here on purpose until the
 * Wallet module adds a proper "earning" / "delivery_payout" transaction
 * type tied to delivered shipments. See INTEGRATION_NOTES.md.
 *
 * UPDATE: a separate `earnings` module (GET /captain/earnings) has since
 * been built by a teammate, which sums Shipment.estimatedPriceMax on
 * delivered shipments instead of touching Wallet at all. That's a
 * different, valid approach — once confirmed, this function can either
 * call into that module's service or be removed in favor of it, instead
 * of maintaining two separate earnings calculations. See
 * INTEGRATION_NOTES.md section 6/9.
 */
// eslint-disable-next-line no-unused-vars
const getTodayEarnings = async (captainId) => {
  // Deliberately not querying anything yet — see comment above.
  // captainId is kept as a parameter so the signature is ready once this is wired up.
  return 0;
};

const getCaptainDashboard = async (captainUserId) => {
  const DriverModel = (await import("../../database/models/Driver.js")).default;
  const driver = await DriverModel.findOne({ user: captainUserId });
  if (!driver) {
    throw new Error("Driver profile not found");
  }

  const [requests, todayEarnings] = await Promise.all([
    getIncomingRequests(driver),
    getTodayEarnings(driver._id),
  ]);

  return {
    requests,
    earnings: {
      todayEarnings,
    },
    activeOfficeId: driver.officeId || null,
  };
};

const getInvitations = async (captainUserId) => {
  const DriverModel = (await import("../../database/models/Driver.js")).default;
  const driver = await DriverModel.findOne({ user: captainUserId });
  if (!driver) return [];

  const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
  const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");

  const invitations = await OfficeCaptain.find({
    captainId: driver._id,
    status: OFFICE_CAPTAIN_STATUS.INVITED,
  })
    .populate({
      path: "officeId",
      select: "businessName user",
      populate: {
        path: "user",
        select: "email phone",
      },
    })
    .lean();

  return invitations.map((inv) => ({
    id: inv._id,
    officeName: inv.officeId?.businessName || "Unknown Office",
    officeEmail: inv.officeId?.user?.email || "",
    officePhone: inv.officeId?.user?.phone || "",
    status: inv.status,
    invitedAt: inv.createdAt,
  }));
};

const acceptInvitation = async (captainUserId, invitationId, reqMetadata) => {
  const DriverModel = (await import("../../database/models/Driver.js")).default;
  const ApiError = (await import("../../shared/utils/ApiError.js")).default;
  const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
  const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");
  const { logOfficeCaptainAction } = await import("../../shared/utils/auditLogger.js");
  const { getIO } = await import("../../config/socket.js");

  const driver = await DriverModel.findOne({ user: captainUserId });
  if (!driver) throw ApiError.notFound("Driver profile not found");

  const invitation = await OfficeCaptain.findOne({
    _id: invitationId,
    captainId: driver._id,
    status: OFFICE_CAPTAIN_STATUS.INVITED,
  });

  if (!invitation) throw ApiError.notFound("Invitation not found or no longer active");

  const existingActive = await OfficeCaptain.findOne({
    officeId: invitation.officeId,
    captainId: driver._id,
    status: { $in: [OFFICE_CAPTAIN_STATUS.ACTIVE, OFFICE_CAPTAIN_STATUS.SUSPENDED] }
  });
  if (existingActive) {
    throw ApiError.conflict("You already have an active or suspended relationship with this office");
  }

  invitation.status = OFFICE_CAPTAIN_STATUS.ACTIVE;
  invitation.joinedAt = new Date();
  invitation.joinedBy = captainUserId; // Captian joined by accepting
  invitation.role = "captain";
  await invitation.save();

  // Maintain backward compatibility for legacy Driver.officeId field
  if (!driver.officeId) {
    driver.officeId = invitation.officeId;
    await driver.save();
  }

  await logOfficeCaptainAction({
    officeId: invitation.officeId,
    captainId: driver._id,
    action: "Invitation Accepted",
    reqMetadata
  });

  // Emit socket events
  try {
    const io = getIO();
    io.to(`office:${invitation.officeId}`).emit("office_invitation_accepted", { invitationId, captainId: driver._id });
    io.to(`office:${invitation.officeId}`).emit("captain_joined_office", { captainId: driver._id });
    io.to(`user:${captainUserId}`).emit("office_invitation_accepted", { invitationId, officeId: invitation.officeId });
    
    // Also emit office statistics update
    const officeService = (await import("../office/office.service.js")).default;
    const stats = await officeService.getCaptains(invitation.invitedBy || captainUserId, { limit: 1 }); // just to trigger stats if needed, or emit stats
  } catch (err) {
    console.error("Socket error on accept invitation:", err);
  }

  // Send real-time notification to office
  try {
    const OfficeModel = (await import("../../database/models/Office.js")).default;
    const office = await OfficeModel.findById(invitation.officeId);
    if (office && office.user) {
      const notificationService = (await import("../notifications/notifications.service.js")).default;
      const captainUser = await DriverModel.findById(driver._id).populate("user", "fullName");
      await notificationService.createNotification({
        userId: office.user,
        type: "office_invite_accepted",
        title: "Invitation Accepted",
        message: `Captain ${captainUser.user?.fullName || "A Driver"} accepted your invitation.`
      });
    }
  } catch (err) {
    console.error("Non-blocking notification error:", err);
  }

  return { message: "Invitation accepted successfully", status: OFFICE_CAPTAIN_STATUS.ACTIVE };
};

const rejectInvitation = async (captainUserId, invitationId, reqMetadata) => {
  const DriverModel = (await import("../../database/models/Driver.js")).default;
  const ApiError = (await import("../../shared/utils/ApiError.js")).default;
  const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
  const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");
  const { logOfficeCaptainAction } = await import("../../shared/utils/auditLogger.js");
  const { getIO } = await import("../../config/socket.js");

  const driver = await DriverModel.findOne({ user: captainUserId });
  if (!driver) throw ApiError.notFound("Driver profile not found");

  const invitation = await OfficeCaptain.findOne({
    _id: invitationId,
    captainId: driver._id,
    status: OFFICE_CAPTAIN_STATUS.INVITED,
  });

  if (!invitation) throw ApiError.notFound("Invitation not found or no longer active");

  invitation.status = OFFICE_CAPTAIN_STATUS.REJECTED;
  await invitation.save();

  await logOfficeCaptainAction({
    officeId: invitation.officeId,
    captainId: driver._id,
    action: "Invitation Rejected",
    reqMetadata
  });

  // Emit socket events
  try {
    const io = getIO();
    io.to(`office:${invitation.officeId}`).emit("office_invitation_rejected", { invitationId, captainId: driver._id });
    io.to(`user:${captainUserId}`).emit("office_invitation_rejected", { invitationId, officeId: invitation.officeId });
  } catch (err) {
    console.error("Socket error on reject invitation:", err);
  }

  // Send real-time notification to office
  try {
    const OfficeModel = (await import("../../database/models/Office.js")).default;
    const office = await OfficeModel.findById(invitation.officeId);
    if (office && office.user) {
      const notificationService = (await import("../notifications/notifications.service.js")).default;
      const captainUser = await DriverModel.findById(driver._id).populate("user", "fullName");
      await notificationService.createNotification({
        userId: office.user,
        type: "office_invite_rejected",
        title: "Invitation Rejected",
        message: `Captain ${captainUser.user?.fullName || "A Driver"} rejected your invitation.`
      });
    }
  } catch (err) {
    console.error("Non-blocking notification error:", err);
  }

  return { message: "Invitation rejected successfully", status: OFFICE_CAPTAIN_STATUS.REJECTED };
};

const getMyOffices = async (captainUserId) => {
  const DriverModel = (await import("../../database/models/Driver.js")).default;
  const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
  const Office = (await import("../../database/models/Office.js")).default;
  const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");

  const driver = await DriverModel.findOne({ user: captainUserId });
  if (!driver) return [];

  // 1. Fetch active/suspended relations
  const relations = await OfficeCaptain.find({
    captainId: driver._id,
    status: { $in: [OFFICE_CAPTAIN_STATUS.ACTIVE, OFFICE_CAPTAIN_STATUS.SUSPENDED] }
  })
    .populate({
      path: "officeId",
      select: "businessName user",
      populate: {
        path: "user",
        select: "email phone"
      }
    })
    .lean();

  // 2. Check for legacy office
  const legacyOfficeId = driver.officeId;
  const hasLegacyInRelations = legacyOfficeId && relations.some(r => r.officeId && r.officeId._id.toString() === legacyOfficeId.toString());

  if (legacyOfficeId && !hasLegacyInRelations) {
    const legacyOffice = await Office.findById(legacyOfficeId)
      .populate("user", "email phone")
      .lean();

    if (legacyOffice) {
      relations.push({
        officeId: legacyOffice,
        status: OFFICE_CAPTAIN_STATUS.ACTIVE,
        joinedAt: driver.createdAt || new Date(),
        isLegacy: true
      });
    }
  }

  // 3. Count active shipments for each office
  const officeIds = relations.map(r => r.officeId?._id).filter(Boolean);
  const activeCounts = await Shipment.aggregate([
    {
      $match: {
        captain: captainUserId,
        assignedOffice: { $in: officeIds },
        status: {
          $in: [
            SHIPMENT_STATUS.CAPTAIN_ASSIGNMENT,
            SHIPMENT_STATUS.PICKED_UP,
            SHIPMENT_STATUS.IN_TRANSIT,
            SHIPMENT_STATUS.OUT_FOR_DELIVERY
          ]
        }
      }
    },
    {
      $group: {
        _id: "$assignedOffice",
        count: { $sum: 1 }
      }
    }
  ]);

  const countsMap = {};
  activeCounts.forEach(c => {
    countsMap[c._id.toString()] = c.count;
  });

  return relations.map(r => ({
    id: r.officeId?._id,
    officeName: r.officeId?.businessName || "Unknown Office",
    officeEmail: r.officeId?.user?.email || "",
    officePhone: r.officeId?.user?.phone || "",
    status: r.status,
    joinedAt: r.joinedAt || r.createdAt || driver.createdAt || new Date(),
    activeShipments: countsMap[r.officeId?._id.toString()] || 0,
    isDefault: driver.defaultOfficeId?.toString() === r.officeId?._id.toString()
  }));
};

const leaveOffice = async (captainUserId, officeId, reqMetadata) => {
  const DriverModel = (await import("../../database/models/Driver.js")).default;
  const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
  const ApiError = (await import("../../shared/utils/ApiError.js")).default;
  const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");
  const { logOfficeCaptainAction } = await import("../../shared/utils/auditLogger.js");

  const driver = await DriverModel.findOne({ user: captainUserId });
  if (!driver) throw ApiError.notFound("Driver profile not found");

  // Check for active shipments / pending assignments from this office
  const activeShipment = await Shipment.findOne({
    captain: captainUserId,
    assignedOffice: officeId,
    status: {
      $in: [
        SHIPMENT_STATUS.CAPTAIN_ASSIGNMENT,
        SHIPMENT_STATUS.PICKED_UP,
        SHIPMENT_STATUS.IN_TRANSIT,
        SHIPMENT_STATUS.OUT_FOR_DELIVERY
      ]
    }
  });

  if (activeShipment) {
    if (activeShipment.status === SHIPMENT_STATUS.CAPTAIN_ASSIGNMENT) {
      throw ApiError.badRequest("Cannot leave office: Pending shipment assignment exists.");
    } else {
      throw ApiError.badRequest("Cannot leave office: Active delivery is in progress.");
    }
  }

  // Update status to LEFT
  await OfficeCaptain.findOneAndUpdate(
    { captainId: driver._id, officeId },
    {
      status: OFFICE_CAPTAIN_STATUS.LEFT,
      leftAt: new Date()
    },
    { upsert: true }
  );

  // Sync legacy officeId and defaultOfficeId
  let updated = false;
  if (driver.officeId && driver.officeId.toString() === officeId.toString()) {
    driver.officeId = null;
    updated = true;
  }
  if (driver.defaultOfficeId && driver.defaultOfficeId.toString() === officeId.toString()) {
    driver.defaultOfficeId = null;
    updated = true;
  }
  if (updated) {
    await driver.save();
  }

  await logOfficeCaptainAction({
    officeId,
    captainId: driver._id,
    action: "Captain Left Office",
    reqMetadata
  });

  // Emit socket events
  try {
    const { getIO } = await import("../../config/socket.js");
    const io = getIO();
    io.to(`office:${officeId}`).emit("captain_left_office", { captainId: driver._id });
    io.to(`user:${captainUserId}`).emit("captain_left_office", { officeId });
  } catch (err) {
    console.error("Socket error on leave office:", err);
  }

  // Send real-time notification to office
  try {
    const OfficeModel = (await import("../../database/models/Office.js")).default;
    const office = await OfficeModel.findById(officeId);
    if (office && office.user) {
      const notificationService = (await import("../notifications/notifications.service.js")).default;
      const captainUser = await DriverModel.findById(driver._id).populate("user", "fullName");
      await notificationService.createNotification({
        userId: office.user,
        type: "office_relation_update",
        title: "Captain Left Office",
        message: `Captain ${captainUser.user?.fullName || "A Driver"} has left your office.`
      });
    }
  } catch (err) {
    console.error("Non-blocking notification error:", err);
  }

  return { message: "Left office successfully" };
};

const switchActiveOffice = async (captainUserId, officeId) => {
  const DriverModel = (await import("../../database/models/Driver.js")).default;
  const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
  const ApiError = (await import("../../shared/utils/ApiError.js")).default;
  const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");
  const { getIO } = await import("../../config/socket.js");

  const driver = await DriverModel.findOne({ user: captainUserId });
  if (!driver) throw ApiError.notFound("Driver profile not found");

  if (!officeId || officeId === "independent" || officeId === "null") {
    // Switch to Independent Mode
    const oldActiveOfficeId = driver.activeOfficeId || driver.officeId;
    driver.workingMode = "independent";
    driver.activeOfficeId = null;
    driver.officeId = null;
    await driver.save();
    
    // Emit socket event
    try {
      getIO().to(`user:${captainUserId}`).emit("captain_status_changed", { 
        captainId: driver._id, 
        workingMode: "independent",
        activeOfficeId: null 
      });
      
      // Also broadcast to former active office
      if (oldActiveOfficeId) {
        getIO().to(`office:${oldActiveOfficeId}`).emit("captain_status_changed", { 
          captainId: driver._id, 
          status: driver.status,
          workingMode: "independent",
          activeOfficeId: null
        });
      }
    } catch {}

    return { 
      message: "Switched to Independent mode successfully", 
      workingMode: "independent",
      activeOfficeId: null 
    };
  }

  // Verify affiliation exists and is active/suspended
  const affiliation = await OfficeCaptain.findOne({
    captainId: driver._id,
    officeId,
    status: { $in: [OFFICE_CAPTAIN_STATUS.ACTIVE, OFFICE_CAPTAIN_STATUS.SUSPENDED] }
  });

  if (!affiliation) {
    throw ApiError.badRequest("Cannot switch active office: No active affiliation found with this office.");
  }

  if (affiliation.status === OFFICE_CAPTAIN_STATUS.SUSPENDED) {
    throw ApiError.forbidden("Cannot switch active office: Your affiliation is currently suspended.");
  }

  driver.workingMode = "office";
  driver.activeOfficeId = officeId;
  driver.officeId = officeId;
  await driver.save();

  // Emit socket event
  try {
    getIO().to(`user:${captainUserId}`).emit("captain_status_changed", { 
      captainId: driver._id, 
      workingMode: "office",
      activeOfficeId: officeId 
    });
    getIO().to(`office:${officeId}`).emit("captain_status_changed", { 
      captainId: driver._id, 
      status: driver.status,
      workingMode: "office",
      activeOfficeId: officeId
    });
  } catch {}

  return { 
    message: "Switched active office successfully", 
    workingMode: "office",
    activeOfficeId: officeId 
  };
};

const setDefaultOffice = async (captainUserId, officeId) => {
  const DriverModel = (await import("../../database/models/Driver.js")).default;
  const OfficeCaptain = (await import("../../database/models/OfficeCaptain.js")).default;
  const ApiError = (await import("../../shared/utils/ApiError.js")).default;
  const { OFFICE_CAPTAIN_STATUS } = await import("../../shared/constants/officeCaptainStatus.js");

  const driver = await DriverModel.findOne({ user: captainUserId });
  if (!driver) throw ApiError.notFound("Driver profile not found");

  // Check if relationship exists (active or suspended relation, or legacy)
  const hasRelation = await OfficeCaptain.findOne({
    captainId: driver._id,
    officeId,
    status: { $in: [OFFICE_CAPTAIN_STATUS.ACTIVE, OFFICE_CAPTAIN_STATUS.SUSPENDED] }
  });

  const isLegacy = driver.officeId && driver.officeId.toString() === officeId.toString();

  if (!hasRelation && !isLegacy) {
    throw ApiError.badRequest("Cannot set default office: No active affiliation found with this office.");
  }

  driver.defaultOfficeId = officeId;
  // Also sync legacy officeId
  driver.officeId = officeId;
  await driver.save();

  return { message: "Default office set successfully" };
};

export default {
  getIncomingRequests,
  getTodayEarnings,
  getCaptainDashboard,
  getInvitations,
  acceptInvitation,
  rejectInvitation,
  getMyOffices,
  leaveOffice,
  setDefaultOffice,
  switchActiveOffice,
};
