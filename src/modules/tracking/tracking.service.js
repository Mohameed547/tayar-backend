// import Tracking, {
//   TRACKING_STATUS,
// } from "../../database/models/Tracking.model.js";
// import Shipment from "../../database/models/Shipment.model.js";
// import ApiError from "../../shared/utils/ApiError.js";
// import { getIO } from "../../config/socket.js";
// import notificationsService from "../notifications/notifications.service.js";

// const distanceKm = ([lng1, lat1], [lng2, lat2]) => {
//   const R = 6371;
//   const dLat = ((lat2 - lat1) * Math.PI) / 180;
//   const dLng = ((lng2 - lng1) * Math.PI) / 180;
//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos((lat1 * Math.PI) / 180) *
//       Math.cos((lat2 * Math.PI) / 180) *
//       Math.sin(dLng / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// };

// const computeProgress = (pickupCoords, deliveryCoords, currentCoords) => {
//   const total = distanceKm(pickupCoords, deliveryCoords);
//   if (total === 0) return 100;

//   const remaining = distanceKm(currentCoords, deliveryCoords);
//   const traveled = total - remaining;
//   const percent = (traveled / total) * 100;

//   return Math.max(0, Math.min(100, Math.round(percent)));
// };

// const STATUS_NOTIFICATION_COPY = {
//   [TRACKING_STATUS.ASSIGNED]: {
//     type: "offer_accepted",
//     title: "Captain assigned",
//   },
//   [TRACKING_STATUS.PICKED_UP]: {
//     type: "picked_up",
//     title: "Package picked up!",
//   },
//   [TRACKING_STATUS.IN_TRANSIT]: { type: "in_transit", title: "On the way" },
//   [TRACKING_STATUS.DELIVERED]: { type: "delivered", title: "Delivered" },
//   [TRACKING_STATUS.CANCELLED]: {
//     type: "cancelled",
//     title: "Shipment cancelled",
//   },
// };

// const initTracking = async (shipmentId, captainId) => {
//   const existing = await Tracking.findOne({ shipment: shipmentId });
//   if (existing) {
//     throw new ApiError(409, "Tracking already initialized for this shipment");
//   }

//   const tracking = await Tracking.create({
//     shipment: shipmentId,
//     captain: captainId,
//     status: TRACKING_STATUS.ASSIGNED,
//     milestones: [{ status: TRACKING_STATUS.ASSIGNED, timestamp: new Date() }],
//   });

//   return tracking;
// };

// const getTrackingByShipmentId = async (shipmentId) => {
//   const tracking = await Tracking.findOne({ shipment: shipmentId })
//     .populate("captain", "fullName phone profileImage")
//     .populate(
//       "shipment",
//       "pickupAddress deliveryAddress pickupCoords deliveryCoords customer",
//     );

//   if (!tracking) {
//     throw new ApiError(404, "No tracking record found for this shipment");
//   }
//   return tracking;
// };

// const recordLocationPing = async (shipmentId, captainId, { lng, lat }) => {
//   const tracking = await Tracking.findOne({ shipment: shipmentId }).populate(
//     "shipment",
//     "pickupCoords deliveryCoords",
//   );
//   if (!tracking)
//     throw new ApiError(404, "No tracking record found for this shipment");

//   if (String(tracking.captain) !== String(captainId)) {
//     throw new ApiError(
//       403,
//       "You are not the assigned captain for this shipment",
//     );
//   }

//   if (
//     [TRACKING_STATUS.DELIVERED, TRACKING_STATUS.CANCELLED].includes(
//       tracking.status,
//     )
//   ) {
//     throw new ApiError(400, "Cannot update location on a closed shipment");
//   }

//   const currentCoords = [lng, lat];
//   tracking.currentLocation = { coords: currentCoords, updatedAt: new Date() };
//   tracking.progressPercent = computeProgress(
//     tracking.shipment.pickupCoords,
//     tracking.shipment.deliveryCoords,
//     currentCoords,
//   );

//   if (tracking.status === TRACKING_STATUS.ASSIGNED) {
//     tracking.status = TRACKING_STATUS.IN_TRANSIT;
//     tracking.milestones.push({
//       status: TRACKING_STATUS.IN_TRANSIT,
//       timestamp: new Date(),
//     });
//     await tracking.save();
//     await Shipment.findByIdAndUpdate(shipmentId, {
//       status: TRACKING_STATUS.IN_TRANSIT,
//     }); // ← السطر الجديد
//   }

  

//   getIO().to(`shipment:${shipmentId}`).emit("locationUpdate", {
//     shipmentId,
//     coords: currentCoords,
//     progressPercent: tracking.progressPercent,
//     updatedAt: tracking.currentLocation.updatedAt,
//   });

//   return tracking;
// };

// const updateStatus = async (shipmentId, captainId, { status, note }) => {
//   const tracking = await Tracking.findOne({ shipment: shipmentId });
//   if (!tracking)
//     throw new ApiError(404, "No tracking record found for this shipment");

//   if (String(tracking.captain) !== String(captainId)) {
//     throw new ApiError(
//       403,
//       "You are not the assigned captain for this shipment",
//     );
//   }

//   const validTransitions = {
//     [TRACKING_STATUS.ASSIGNED]: [
//       TRACKING_STATUS.PICKED_UP,
//       TRACKING_STATUS.CANCELLED,
//     ],
//     [TRACKING_STATUS.PICKED_UP]: [
//       TRACKING_STATUS.IN_TRANSIT,
//       TRACKING_STATUS.CANCELLED,
//     ],
//     [TRACKING_STATUS.IN_TRANSIT]: [
//       TRACKING_STATUS.DELIVERED,
//       TRACKING_STATUS.CANCELLED,
//     ],
//     [TRACKING_STATUS.DELIVERED]: [],
//     [TRACKING_STATUS.CANCELLED]: [],
//   };

//   if (!validTransitions[tracking.status]?.includes(status)) {
//     throw new ApiError(
//       400,
//       `Cannot move shipment from ${tracking.status} to ${status}`,
//     );
//   }

//   tracking.status = status;
//   tracking.milestones.push({ status, timestamp: new Date(), note });
//   await tracking.save();
//   await Shipment.findByIdAndUpdate(shipmentId, { status }); // ← السطر الجديد

//   if (status === TRACKING_STATUS.DELIVERED) {
//     tracking.progressPercent = 100;
//   }

//   ;

//   getIO().to(`shipment:${shipmentId}`).emit("statusUpdate", {
//     shipmentId,
//     status,
//     note,
//     timestamp: new Date(),
//   });

//   const copy = STATUS_NOTIFICATION_COPY[status];
//   if (copy) {
//     const shipment = await Shipment.findById(shipmentId).select("customer");
//     if (shipment?.customer) {
//       await notificationsService.createNotification({
//         userId: shipment.customer,
//         type: copy.type,
//         title: copy.title,
//         message: note || `${copy.title} for your shipment.`,
//         relatedShipmentId: shipmentId,
//       });
//     }
//   }

//   return tracking;
// };

// export default {
//   initTracking,
//   getTrackingByShipmentId,
//   recordLocationPing,
//   updateStatus,
// };


import Tracking, {
  TRACKING_STATUS,
} from "../../database/models/Tracking.model.js";
import Shipment from "../../database/models/Shipment.model.js";
import ApiError from "../../shared/utils/ApiError.js";
import { getIO } from "../../config/socket.js";
import notificationsService from "../notifications/notifications.service.js";
import Driver from "../../database/models/Driver.js";
import { uploadToCloudinary } from "../../shared/utils/cloudinary.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

const distanceKm = ([lng1, lat1], [lng2, lat2]) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const computeProgress = (pickupCoords, deliveryCoords, currentCoords) => {
  const total = distanceKm(pickupCoords, deliveryCoords);
  if (total === 0) return 100;

  const remaining = distanceKm(currentCoords, deliveryCoords);
  const traveled = total - remaining;
  const percent = (traveled / total) * 100;

  return Math.max(0, Math.min(100, Math.round(percent)));
};

const STATUS_NOTIFICATION_COPY = {
  [TRACKING_STATUS.ASSIGNED]: {
    type: "offer_accepted",
    title: "Captain assigned",
  },
  [TRACKING_STATUS.PICKED_UP]: {
    type: "picked_up",
    title: "Package picked up!",
  },
  [TRACKING_STATUS.IN_TRANSIT]: { type: "in_transit", title: "On the way" },
  [TRACKING_STATUS.DELIVERED]: { type: "delivered", title: "Delivered" },
  [TRACKING_STATUS.CANCELLED]: {
    type: "cancelled",
    title: "Shipment cancelled",
  },
};

const initTracking = async (shipmentId, captainId) => {
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otpCode, 10);

  const existing = await Tracking.findOne({ shipment: shipmentId });
  if (existing) {
    // Tracking record already exists — update the assigned captain (reassign case).
    // Reset status to ASSIGNED so the new captain can progress through the workflow.
    existing.captain = captainId;
    if (existing.status === TRACKING_STATUS.DELIVERED || existing.status === TRACKING_STATUS.CANCELLED) {
      // Shipment was already closed — do not reopen
      throw new ApiError(409, "Tracking already initialized for this shipment and cannot be reassigned");
    }
    existing.status = TRACKING_STATUS.ASSIGNED;
    existing.milestones.push({ status: TRACKING_STATUS.ASSIGNED, timestamp: new Date(), note: "Captain reassigned" });
    await existing.save();

    const driver = await Driver.findOne({ user: captainId });
    if (driver) {
      driver.status = "busy";
      await driver.save();
    }

    const shipment = await Shipment.findByIdAndUpdate(
      shipmentId,
      { 
        "proofOfDelivery.otpCode": otpCode,
        "deliveryVerification": {
          otpHash,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          attempts: 0,
          verified: false,
          verifiedAt: null,
        }
      },
      { new: true }
    );

    if (shipment && shipment.customer) {
      await notificationsService.createNotification({
        userId: shipment.customer,
        type: "offer_accepted",
        title: "New Captain Assigned - Delivery OTP",
        message: `Your shipment has been reassigned to a new captain. Your delivery verification code (OTP) is: ${otpCode}`,
        relatedShipmentId: shipmentId,
      }).catch(err => console.error("Failed to create reassignment notification:", err));
    }

    return existing;
  }

  const tracking = await Tracking.create({
    shipment: shipmentId,
    captain: captainId,
    status: TRACKING_STATUS.ASSIGNED,
    milestones: [{ status: TRACKING_STATUS.ASSIGNED, timestamp: new Date() }],
  });

  const driver = await Driver.findOne({ user: captainId });
  if (driver) {
    driver.status = "busy";
    await driver.save();
  }

  const shipment = await Shipment.findByIdAndUpdate(
    shipmentId,
    { 
      "proofOfDelivery.otpCode": otpCode,
      "deliveryVerification": {
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        attempts: 0,
        verified: false,
        verifiedAt: null,
      }
    },
    { new: true }
  );

  if (shipment && shipment.customer) {
    await notificationsService.createNotification({
      userId: shipment.customer,
      type: "offer_accepted",
      title: "Delivery Verification Code",
      message: `Your shipment has been assigned to a captain. Your delivery verification code (OTP) is: ${otpCode}. Please provide this to the captain to receive your shipment.`,
      relatedShipmentId: shipmentId,
    }).catch(err => console.error("Failed to create assignment notification:", err));
  }

  return tracking;
};

const getTrackingByShipmentId = async (shipmentId) => {
  let query = { shipment: shipmentId };
  if (!shipmentId.match(/^[0-9a-fA-F]{24}$/)) {
    const shipmentDoc = await Shipment.findOne({ trackingNumber: shipmentId.toUpperCase() });
    if (!shipmentDoc) {
      throw new ApiError(404, "Shipment not found");
    }
    query = { shipment: shipmentDoc._id };
  }

  const tracking = await Tracking.findOne(query)
    .populate("captain", "fullName phone profileImage")
    .populate(
      "shipment",
      "pickupAddress deliveryAddress pickupCoords deliveryCoords customer status trackingNumber",
    );

  if (!tracking) {
    throw new ApiError(404, "No tracking record found for this shipment");
  }
  return tracking;
};

const recordLocationPing = async (shipmentId, captainId, { lng, lat }) => {
  let resolvedId = shipmentId;
  if (!shipmentId.match(/^[0-9a-fA-F]{24}$/)) {
    const shipmentDoc = await Shipment.findOne({ trackingNumber: shipmentId.toUpperCase() });
    if (!shipmentDoc) throw new ApiError(404, "Shipment not found");
    resolvedId = shipmentDoc._id;
  }

  const tracking = await Tracking.findOne({ shipment: resolvedId }).populate(
    "shipment",
    "pickupCoords deliveryCoords",
  );
  if (!tracking)
    throw new ApiError(404, "No tracking record found for this shipment");

  if (String(tracking.captain) !== String(captainId)) {
    throw new ApiError(
      403,
      "You are not the assigned captain for this shipment",
    );
  }

  if (
    [TRACKING_STATUS.DELIVERED, TRACKING_STATUS.CANCELLED].includes(
      tracking.status,
    )
  ) {
    throw new ApiError(400, "Cannot update location on a closed shipment");
  }

  const currentCoords = [lng, lat];
  tracking.currentLocation = { coords: currentCoords, updatedAt: new Date() };
  tracking.progressPercent = computeProgress(
    tracking.shipment.pickupCoords,
    tracking.shipment.deliveryCoords,
    currentCoords,
  );

  let justTransitionedToInTransit = false;

  if (tracking.status === TRACKING_STATUS.ASSIGNED) {
    tracking.status = TRACKING_STATUS.IN_TRANSIT;
    tracking.milestones.push({
      status: TRACKING_STATUS.IN_TRANSIT,
      timestamp: new Date(),
    });
    justTransitionedToInTransit = true;
  }

  await tracking.save();

  if (justTransitionedToInTransit) {
    await Shipment.findByIdAndUpdate(resolvedId, {
      status: TRACKING_STATUS.IN_TRANSIT,
    });
  }

  getIO().to(`shipment:${resolvedId}`).emit("locationUpdate", {
    shipmentId: resolvedId,
    coords: currentCoords,
    progressPercent: tracking.progressPercent,
    updatedAt: tracking.currentLocation.updatedAt,
  });

  return tracking;
};

const updateStatus = async (shipmentId, captainId, { status, note, otpCode, recipientName, signatureImage, packageImage, lat, lng }) => {
  let resolvedId = shipmentId;
  if (!shipmentId.match(/^[0-9a-fA-F]{24}$/)) {
    const shipmentDoc = await Shipment.findOne({ trackingNumber: shipmentId.toUpperCase() });
    if (!shipmentDoc) throw new ApiError(404, "Shipment not found");
    resolvedId = shipmentDoc._id;
  }

  const tracking = await Tracking.findOne({ shipment: resolvedId });
  if (!tracking)
    throw new ApiError(404, "No tracking record found for this shipment");

  if (String(tracking.captain) !== String(captainId)) {
    throw new ApiError(
      403,
      "You are not the assigned captain for this shipment",
    );
  }

  const validTransitions = {
    [TRACKING_STATUS.ASSIGNED]: [
      TRACKING_STATUS.PICKED_UP,
      TRACKING_STATUS.CANCELLED,
    ],
    [TRACKING_STATUS.PICKED_UP]: [
      TRACKING_STATUS.IN_TRANSIT,
      TRACKING_STATUS.CANCELLED,
    ],
    [TRACKING_STATUS.IN_TRANSIT]: [
      TRACKING_STATUS.DELIVERED,
      TRACKING_STATUS.CANCELLED,
    ],
    [TRACKING_STATUS.DELIVERED]: [],
    [TRACKING_STATUS.CANCELLED]: [],
  };

  if (!validTransitions[tracking.status]?.includes(status)) {
    throw new ApiError(
      400,
      `Cannot move shipment from ${tracking.status} to ${status}`,
    );
  }

  if (status === TRACKING_STATUS.DELIVERED) {
    if (!packageImage) {
      throw new ApiError(400, "Proof of delivery package photo is required to complete delivery");
    }

    let uploadedSignature = null;
    let uploadedPackage = null;

    if (signatureImage) {
      uploadedSignature = await uploadToCloudinary(signatureImage, "tayar_proof_signatures");
    }
    if (packageImage) {
      uploadedPackage = await uploadToCloudinary(packageImage, "tayar_proof_packages");
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const shipment = await Shipment.findById(resolvedId).session(session);
        if (!shipment) throw new ApiError(404, "Shipment not found");

        // 1. GPS Verification
        if (lat !== undefined && lng !== undefined) {
          if (!shipment.deliveryCoords || shipment.deliveryCoords.length < 2) {
            throw new ApiError(400, "Shipment has no delivery coordinates set");
          }
          const distance = distanceKm([lng, lat], shipment.deliveryCoords);
          shipment.deliveryDistance = Math.round(distance * 1000); // store in meters
          shipment.captainCurrentLocation = {
            type: "Point",
            coordinates: [lng, lat],
          };
          if (distance > 0.2) {
            throw new ApiError(
              400,
              `GPS Verification failed. You must be within 200 meters of the delivery location. Current distance: ${Math.round(distance * 1000)}m`,
            );
          }
        } else {
          throw new ApiError(400, "GPS coordinates are required to verify delivery location");
        }

        // 2. OTP Verification
        let otpValid = false;
        if (shipment.deliveryVerification && shipment.deliveryVerification.otpHash) {
          if (shipment.deliveryVerification.verified) {
            otpValid = true;
          } else {
            if (shipment.deliveryVerification.expiresAt && new Date() > shipment.deliveryVerification.expiresAt) {
              throw new ApiError(400, "OTP has expired. Please generate a new one");
            }
            if (shipment.deliveryVerification.attempts >= 5) {
              throw new ApiError(400, "Maximum OTP verification attempts (5) exceeded. Please generate a new OTP");
            }
            
            shipment.deliveryVerification.attempts += 1;
            const isValid = await bcrypt.compare(otpCode, shipment.deliveryVerification.otpHash);
            if (isValid) {
              shipment.deliveryVerification.verified = true;
              shipment.deliveryVerification.verifiedAt = new Date();
              otpValid = true;
            } else {
              await shipment.save({ session });
              throw new ApiError(400, `Invalid OTP code. Attempts remaining: ${5 - shipment.deliveryVerification.attempts}`);
            }
          }
        } else if (shipment.proofOfDelivery && shipment.proofOfDelivery.otpCode === otpCode) {
          otpValid = true;
        }

        if (!otpValid) {
          throw new ApiError(400, "Invalid delivery verification code (OTP)");
        }

        // Update Shipment status and proof details
        shipment.status = status;
        shipment.proofOfDelivery.recipientName = recipientName;
        shipment.proofOfDelivery.signatureImage = uploadedSignature || shipment.proofOfDelivery.signatureImage;
        shipment.proofOfDelivery.packageImage = uploadedPackage || shipment.proofOfDelivery.packageImage;
        shipment.proofOfDelivery.verifiedAt = new Date();

        if (!shipment.deliveryVerification) {
          shipment.deliveryVerification = {};
        }
        shipment.deliveryVerification.photoUrl = uploadedPackage;
        shipment.deliveryVerification.photoUploadedAt = new Date();

        await shipment.save({ session });

        // Update tracking status
        tracking.status = status;
        tracking.progressPercent = 100;
        tracking.milestones.push({ status, timestamp: new Date(), note });
        await tracking.save({ session });

        // Update driver availability
        const driver = await Driver.findOne({ user: captainId }).session(session);
        if (driver) {
          driver.status = "available";
          driver.totalDeliveries = (driver.totalDeliveries || 0) + 1;
          await driver.save({ session });
        }

        // Release wallet funds inside the transaction
        const walletService = (await import("../wallet/wallet.service.js")).default;
        await walletService.releaseFunds(resolvedId, session);
      });
    } finally {
      await session.endSession();
    }
  } else {
    // Non-delivered status update
    tracking.status = status;
    tracking.milestones.push({ status, timestamp: new Date(), note });
    await tracking.save();

    await Shipment.findByIdAndUpdate(resolvedId, { status });

    if (status === TRACKING_STATUS.CANCELLED) {
      const driver = await Driver.findOne({ user: captainId });
      if (driver) {
        driver.status = "available";
        await driver.save();
      }

      const walletService = (await import("../wallet/wallet.service.js")).default;
      await walletService.refundFunds(resolvedId).catch(err => {
        console.error("Failed to refund escrow funds:", err);
      });
    }
  }

  // Socket status update notification (Executed after transaction committed successfully)
  getIO().to(`shipment:${resolvedId}`).emit("statusUpdate", {
    shipmentId: resolvedId,
    status,
    note,
    timestamp: new Date(),
  });

  // App notification (Executed after transaction committed successfully)
  const copy = STATUS_NOTIFICATION_COPY[status];
  if (copy) {
    const shipment = await Shipment.findById(resolvedId).select("customer assignedOffice");
    if (shipment) {
      if (shipment.customer) {
        await notificationsService.createNotification({
          userId: shipment.customer,
          type: copy.type,
          title: copy.title,
          message: note || `${copy.title} for your shipment.`,
          relatedShipmentId: resolvedId,
        }).catch(err => console.error("Failed to send customer status notification:", err));
      }
      if (shipment.assignedOffice) {
        const OfficeModel = (await import("../../database/models/Office.js")).default;
        const officeDoc = await OfficeModel.findById(shipment.assignedOffice).select("user");
        if (officeDoc && officeDoc.user) {
          await notificationsService.createNotification({
            userId: officeDoc.user,
            type: copy.type,
            title: `Driver Update: ${copy.title}`,
            message: note || `Driver updated shipment status to: ${copy.title}.`,
            relatedShipmentId: resolvedId,
          }).catch(err => console.error("Failed to send office status notification:", err));
        }
      }
    }
  }

  return tracking;
};

const generateNewOTP = async (shipmentId) => {
  let resolvedId = shipmentId;
  if (!shipmentId.match(/^[0-9a-fA-F]{24}$/)) {
    const shipmentDoc = await Shipment.findOne({ trackingNumber: shipmentId.toUpperCase() });
    if (!shipmentDoc) throw new ApiError(404, "Shipment not found");
    resolvedId = shipmentDoc._id;
  }

  const shipment = await Shipment.findById(resolvedId);
  if (!shipment) throw new ApiError(404, "Shipment not found");

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otpCode, 10);

  shipment.deliveryVerification = {
    otpHash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    attempts: 0,
    verified: false,
    verifiedAt: null,
    photoUrl: shipment.deliveryVerification?.photoUrl || null,
    photoUploadedAt: shipment.deliveryVerification?.photoUploadedAt || null,
  };

  // Backwards compatibility
  if (!shipment.proofOfDelivery) {
    shipment.proofOfDelivery = {};
  }
  shipment.proofOfDelivery.otpCode = otpCode;

  await shipment.save();

  if (shipment.customer) {
    await notificationsService.createNotification({
      userId: shipment.customer,
      type: "offer_accepted",
      title: "Delivery OTP Code",
      message: `Your new delivery verification OTP code is: ${otpCode}. It is valid for 10 minutes.`,
      relatedShipmentId: resolvedId,
    }).catch(err => console.error("Failed to create OTP notification:", err));
  }

  return { otpCode, expiresAt: shipment.deliveryVerification.expiresAt };
};

const verifyOTP = async (shipmentId, otpCode) => {
  let resolvedId = shipmentId;
  if (!shipmentId.match(/^[0-9a-fA-F]{24}$/)) {
    const shipmentDoc = await Shipment.findOne({ trackingNumber: shipmentId.toUpperCase() });
    if (!shipmentDoc) throw new ApiError(404, "Shipment not found");
    resolvedId = shipmentDoc._id;
  }

  const shipment = await Shipment.findById(resolvedId);
  if (!shipment) throw new ApiError(404, "Shipment not found");

  if (!shipment.deliveryVerification || !shipment.deliveryVerification.otpHash) {
    throw new ApiError(400, "No OTP has been generated for this shipment");
  }

  if (shipment.deliveryVerification.verified) {
    return { verified: true, message: "OTP already verified" };
  }

  if (shipment.deliveryVerification.expiresAt && new Date() > shipment.deliveryVerification.expiresAt) {
    throw new ApiError(400, "OTP has expired. Please generate a new one");
  }

  if (shipment.deliveryVerification.attempts >= 5) {
    throw new ApiError(400, "Maximum OTP verification attempts (5) exceeded. Please generate a new OTP");
  }

  shipment.deliveryVerification.attempts += 1;

  const isValid = await bcrypt.compare(otpCode, shipment.deliveryVerification.otpHash);
  if (!isValid) {
    await shipment.save();
    throw new ApiError(400, `Invalid OTP code. Attempts remaining: ${5 - shipment.deliveryVerification.attempts}`);
  }

  shipment.deliveryVerification.verified = true;
  shipment.deliveryVerification.verifiedAt = new Date();
  
  if (!shipment.proofOfDelivery) {
    shipment.proofOfDelivery = {};
  }
  shipment.proofOfDelivery.verifiedAt = new Date();

  await shipment.save();

  return { verified: true, message: "OTP verified successfully" };
};

export default {
  initTracking,
  getTrackingByShipmentId,
  recordLocationPing,
  updateStatus,
  generateNewOTP,
  verifyOTP,
};
