import disputesService from "./disputes.service.js";
import supportService from "../../support/support.service.js";
import ApiResponse from "../../../shared/utils/ApiResponse.js";

const getDisputes = async (req, res, next) => {
    try {
        const { status, page, limit } = req.query;
        const result = await disputesService.getDisputes({
            status,
            page,
            limit,
        });
        return res.status(200).json(ApiResponse.success(result));
    } catch (err) {
        next(err);
    }
};

const resolveDispute = async (req, res, next) => {
    try {
        const result = await disputesService.resolveDispute(req.params.id);
        return res
            .status(200)
            .json(ApiResponse.success(result, "Dispute resolved"));
    } catch (err) {
        next(err);
    }
};

const addAdminTicketMessage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        const senderName = "Admin";

        const message = await supportService.addMessage(id, text, "admin", senderName);

        return res
            .status(201)
            .json(ApiResponse.success(message, "Message added successfully"));
    } catch (err) {
        next(err);
    }
};

export default { getDisputes, resolveDispute, addAdminTicketMessage };
