import Support from "../../database/models/Support.model.js";
import ApiError from "../../shared/utils/ApiError.js";
import { getPagination } from "../../shared/utils/pagination.js";

const createTicket = async (customerId, body) => {
    const { subject, category, message, relatedShipment } = body;

    const ticket = await Support.create({
        customer: customerId,
        subject,
        category,
        message,
        relatedShipment: relatedShipment ?? null,
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

export default { createTicket, getMyTickets, getTicketById };
