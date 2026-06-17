import supportService from "./support.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

// POST /api/support
export const createTicket = async (req, res, next) => {
    try {
        const customerId = req.user._id;
        const ticket = await supportService.createTicket(customerId, req.body);

        return res
            .status(201)
            .json(ApiResponse.success(ticket, "Ticket created successfully"));
    } catch (err) {
        next(err);
    }
};

// GET /api/support  (my tickets)
export const getMyTickets = async (req, res, next) => {
    try {
        const customerId = req.user._id;
        const { status, page, limit } = req.query;
        const statusFilter = status ? status.split(",") : null;

        const result = await supportService.getMyTickets(
            customerId,
            statusFilter,
            {
                page,
                limit,
            },
        );

        return res.status(200).json(ApiResponse.success(result));
    } catch (err) {
        next(err);
    }
};

// GET /api/support/:id
export const getTicketById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const customerId = req.user._id;

        const ticket = await supportService.getTicketById(id, customerId);

        return res.status(200).json(ApiResponse.success(ticket));
    } catch (err) {
        next(err);
    }
};
