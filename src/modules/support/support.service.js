import Support from "../../database/models/Support.model.js";
import ApiError from "../../shared/utils/ApiError.js";
import { getPagination } from "../../shared/utils/pagination.js";

const createTicket = async (customerId, body) => {
    const { subject, category, message, relatedShipment } = body;

    let shipmentId = null;
    if (relatedShipment) {
        const mongoose = (await import("mongoose")).default;
        const Shipment = (await import("../../database/models/Shipment.model.js")).default;
        
        let shipment = null;
        if (mongoose.Types.ObjectId.isValid(relatedShipment)) {
            shipment = await Shipment.findById(relatedShipment);
        } else {
            shipment = await Shipment.findOne({ trackingNumber: relatedShipment });
        }

        if (!shipment) {
            throw new ApiError(400, "Shipment not found with the provided ID or tracking number");
        }
        shipmentId = shipment._id;
    }

    const ticket = await Support.create({
        customer: customerId,
        subject,
        category,
        message,
        relatedShipment: shipmentId,
    });

    return ticket;
};

const getMyTickets = async (customerId, statusFilter, { page, limit }) => {
    const { skip, take } = getPagination(page, limit);

    const query = { customer: customerId };
    if (statusFilter) query.status = { $in: statusFilter };

    const [tickets, total] = await Promise.all([
        Support.find(query).sort({ createdAt: -1 }).skip(skip).limit(take),
        Support.countDocuments(query),
    ]);

    return { tickets, total, page: Number(page) || 1, limit: take };
};

const getTicketById = async (id, customerId) => {
    const ticket = await Support.findOne({ _id: id, customer: customerId });

    if (!ticket) throw new ApiError(404, "Ticket not found");

    return ticket;
};

const addMessage = async (id, text, sender = "user", senderName = "User") => {
    const ticket = await Support.findById(id);
    if (!ticket) throw new ApiError(404, "Ticket not found");

    const message = {
        sender,
        senderName,
        text,
        createdAt: new Date(),
    };

    ticket.messages.push(message);
    await ticket.save();

    // Broadcast real-time message via socket
    try {
        const { getIO } = await import("../../config/socket.js");
        const io = getIO();

        // 1. Broadcast the message to the ticket channel (live chat widget)
        io.emit(`ticket:${id}:message`, message);

        // 2. If the sender is admin, also push a notification to the ticket owner
        if (sender === "admin" && ticket.customer) {
            const customerId = ticket.customer.toString();
            io.to(`user:${customerId}`).emit("newNotification", {
                type: "support_reply",
                title: "رد من الدعم الفني",
                message: `وصلك رد جديد من فريق الدعم على تذكرتك: "${text.slice(0, 60)}${text.length > 60 ? "..." : ""}"`,
            });
        }
    } catch (err) {
        console.warn("Socket broadcast failed for message:", err);
    }

    return message;
};

export default { createTicket, getMyTickets, getTicketById, addMessage };
