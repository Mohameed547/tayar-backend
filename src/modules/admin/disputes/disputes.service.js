import Support from "../../../database/models/Support.model.js";
import Shipment from "../../../database/models/Shipment.model.js";
import ApiError from "../../../shared/utils/ApiError.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ticket عمره أكتر من 24 ساعة وlسه sent → urgent
const getStatus = (ticket) => {
    if (ticket.status === "resolved") return "resolved";
    const ageHours = (Date.now() - new Date(ticket.createdAt)) / 36e5;
    return ageHours > 24 ? "urgent" : "open";
};

const formatTicket = (ticket, shipment = null, driver = null) => {
    const customerName = ticket.customer?.fullName || "Customer";
    const initials = customerName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const defendant = driver
        ? { name: driver.fullName || "Driver", type: "driver" }
        : { name: "Support Team", type: "office" };

    return {
        id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        orderId: shipment?.trackingNumber
            ? `#${shipment.trackingNumber}`
            : `#${ticket.ticketNumber}`,
        title: ticket.subject,
        description: ticket.message,
        status: getStatus(ticket),
        amountAtRisk: shipment?.estimatedPriceMax || 0,
        createdAt: ticket.createdAt,
        plaintiff: { name: customerName, type: "customer", initials },
        defendant,
        releaseLabel: "Close ticket",
        driverId: driver?._id || null,
        shipmentId: shipment?._id || null,
        category: ticket.category,
        resolvedAt: ticket.resolvedAt || null,
        messages: ticket.messages || [],
    };
};

// ─── getDisputes ──────────────────────────────────────────────────────────────
const getDisputes = async ({ status, page = 1, limit = 20 }) => {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status === "resolved") {
        filter.status = "resolved";
    } else if (status && status !== "all") {
        filter.status = "sent"; // urgent + open كلهم status: "sent" في الـ DB
    }

    const [tickets, total] = await Promise.all([
        Support.find(filter)
            .populate("customer", "fullName email")
            .populate("relatedShipment")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Support.countDocuments(filter),
    ]);

    const shipmentIds = tickets
        .map((t) => t.relatedShipment?._id)
        .filter(Boolean);

    const shipments = await Shipment.find({ _id: { $in: shipmentIds } })
        .populate("captain", "fullName")
        .lean();

    const shipmentsMap = Object.fromEntries(
        shipments.map((s) => [s._id.toString(), s]),
    );

    // ── Stats ──
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const openTicketsList = await Support.find({ status: "sent" }).select("relatedShipment").lean();
    const openShipmentIds = openTicketsList.map((t) => t.relatedShipment).filter(Boolean);

    const [openCount, resolvedThisMonth, amountAtRiskAgg, urgentCount] =
        await Promise.all([
            Promise.resolve(openTicketsList.length),
            Support.countDocuments({
                status: "resolved",
                resolvedAt: { $gte: oneMonthAgo },
            }),
            openShipmentIds.length
                ? Shipment.aggregate([
                      { $match: { _id: { $in: openShipmentIds } } },
                      {
                          $group: {
                              _id: null,
                              total: { $sum: "$estimatedPriceMax" },
                          },
                      },
                  ])
                : Promise.resolve([]),
            Support.countDocuments({
                status: "sent",
                createdAt: { $lte: new Date(Date.now() - 24 * 36e5) },
            }),
        ]);

    const amountAtRisk = amountAtRiskAgg[0]?.total || 0;

    const formattedTickets = tickets.map((t) => {
        const shipment = t.relatedShipment
            ? shipmentsMap[
                  t.relatedShipment._id?.toString() ||
                      t.relatedShipment.toString()
              ]
            : null;
        const driver = shipment?.captain || null;
        return formatTicket(t, shipment, driver);
    });

    // فلتر urgent على الفرونت بعد الـ format
    const filtered =
        status === "urgent"
            ? formattedTickets.filter((t) => t.status === "urgent")
            : formattedTickets;

    return {
        disputes: filtered,
        stats: {
            open: openCount,
            urgent: urgentCount,
            resolvedThisMonth,
            avgResolveHours: 18,
            amountAtRisk,
        },
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
        },
    };
};

// ─── resolveDispute ───────────────────────────────────────────────────────────
const resolveDispute = async (id) => {
    const ticket = await Support.findById(id);
    if (!ticket) throw new ApiError(404, "Ticket not found");
    if (ticket.status === "resolved")
        throw new ApiError(400, "Ticket already resolved");

    ticket.status = "resolved";
    ticket.resolvedAt = new Date();
    await ticket.save();

    return { id: ticket._id, status: "resolved" };
};

export default { getDisputes, resolveDispute };
