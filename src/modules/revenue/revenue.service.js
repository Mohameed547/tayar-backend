import Escrow from "../../database/models/Escrow.model.js";

const getPeriodRange = (period) => {
  const now = new Date();
  const start = new Date();

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setDate(now.getDate() - 7);
  } else if (period === "month") {
    start.setMonth(now.getMonth() - 1);
  } else if (period === "year") {
    start.setFullYear(now.getFullYear() - 1);
  }

  return { start, end: now };
};

const getRevenue = async (period = "month") => {
  const { start, end } = getPeriodRange(period);

  const escrows = await Escrow.find({
    status: "released",
    createdAt: { $gte: start, $lte: end },
  })
    .populate("shipment", "trackingNumber")
    .populate("customer", "fullName")
    .populate("driver", "fullName");

  const totalRevenue = escrows.reduce((sum, e) => sum + e.amount, 0);
  const totalCommission = escrows.reduce(
    (sum, e) => sum + e.commissionAmount,
    0,
  );
  const totalShipments = escrows.length;
  const avgOrderValue = totalShipments
    ? Math.round(totalRevenue / totalShipments)
    : 0;

  const dayMap = {};
  escrows.forEach((e) => {
    const date = e.createdAt.toISOString().split("T")[0];
    if (!dayMap[date]) dayMap[date] = { date, revenue: 0, commission: 0 };
    dayMap[date].revenue += e.amount;
    dayMap[date].commission += e.commissionAmount;
  });
  const revenueByDay = Object.values(dayMap).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const records = escrows.map((e) => ({
    id: e._id,
    trackingNumber: e.shipment?.trackingNumber || "N/A",
    customerName: e.customer?.fullName || "N/A",
    driverName: e.driver?.fullName || "N/A",
    amount: e.amount,
    commission: e.commissionAmount,
    date: e.createdAt,
  }));

  return {
    stats: {
      totalRevenue,
      totalCommission,
      totalShipments,
      avgOrderValue,
      revenueByDay,
    },
    records,
  };
};

export default { getRevenue };
