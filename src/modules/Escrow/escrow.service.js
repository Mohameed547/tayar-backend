import Escrow from "../../database/models/Escrow.model.js";
import ApiError from "../../shared/utils/ApiError.js";

const getAllEscrow = async (statusFilter) => {
  const query = {};
  if (statusFilter && statusFilter !== "all") query.status = statusFilter;

  const [transactions, allEscrow] = await Promise.all([
    Escrow.find(query)
      .sort({ createdAt: -1 })
      .populate("shipment", "trackingNumber")
      .populate("customer", "fullName")
      .populate("driver", "fullName"),
    Escrow.find(),
  ]);

  const stats = {
    totalHeld: allEscrow
      .filter((e) => e.status === "held")
      .reduce((sum, e) => sum + e.amount, 0),
    totalReleased: allEscrow
      .filter((e) => e.status === "released")
      .reduce((sum, e) => sum + e.amount, 0),
    totalRefunded: allEscrow
      .filter((e) => e.status === "refunded")
      .reduce((sum, e) => sum + e.amount, 0),
    pendingCount: allEscrow.filter((e) => e.status === "held").length,
  };

  return { transactions, stats };
};

const releaseEscrow = async (id) => {
  const escrow = await Escrow.findById(id);
  if (!escrow) throw new ApiError(404, "Escrow transaction not found");

  if (!["held", "disputed"].includes(escrow.status))
    throw new ApiError(
      400,
      `Cannot release escrow with status: ${escrow.status}`,
    );

  escrow.status = "released";
  escrow.releasedAt = new Date();
  await escrow.save();

  return escrow;
};

const refundEscrow = async (id) => {
  const escrow = await Escrow.findById(id);
  if (!escrow) throw new ApiError(404, "Escrow transaction not found");

  if (!["held", "disputed"].includes(escrow.status))
    throw new ApiError(
      400,
      `Cannot refund escrow with status: ${escrow.status}`,
    );

  escrow.status = "refunded";
  escrow.refundedAt = new Date();
  await escrow.save();

  return escrow;
};

export default { getAllEscrow, releaseEscrow, refundEscrow };
