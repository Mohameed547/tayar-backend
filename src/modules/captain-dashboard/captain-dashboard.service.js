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
const getIncomingRequests = async () => {
  const shipments = await Shipment.find({
    status: SHIPMENT_STATUS.PENDING_OFFERS,
    captain: null,
  })
    .sort({ createdAt: -1 })
    .limit(20);

  return shipments.map((s) => ({
    id: s.trackingNumber,
    route: `${s.pickupAddress} -> ${s.deliveryAddress}`,
    weight: `${s.weight} kg`,
    packageType: s.packageType,
    // No deadline field exists on Shipment yet — see note in
    // INTEGRATION_NOTES if you need a real expiry. Frontend just renders
    // this as text, so an empty string is safe (not "undefined").
    expiresIn: "",
    pickup: s.pickupAddress,
    dropoff: s.deliveryAddress,
  }));
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

const getCaptainDashboard = async (captainId) => {
  const [requests, todayEarnings] = await Promise.all([
    getIncomingRequests(),
    getTodayEarnings(captainId),
  ]);

  return {
    requests,
    earnings: {
      todayEarnings,
      // The other three earnings fields (thisMonth, clearedPayouts,
      // platformFees) belong to the Earnings screen, not Overview — left
      // out here on purpose since Overview.tsx never reads them.
    },
  };
};

export default {
  getIncomingRequests,
  getTodayEarnings,
  getCaptainDashboard,
};
