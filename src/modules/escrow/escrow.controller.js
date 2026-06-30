import escrowService from "./escrow.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

export const getAllEscrow = async (req, res, next) => {
  try {
    const { status } = req.query;
    const result = await escrowService.getAllEscrow(status);
    return res.status(200).json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const releaseEscrow = async (req, res, next) => {
  try {
    const result = await escrowService.releaseEscrow(req.params.id);
    return res
      .status(200)
      .json(ApiResponse.success(result, "Escrow released successfully"));
  } catch (err) {
    next(err);
  }
};

export const refundEscrow = async (req, res, next) => {
  try {
    const result = await escrowService.refundEscrow(req.params.id);
    return res
      .status(200)
      .json(ApiResponse.success(result, "Escrow refunded successfully"));
  } catch (err) {
    next(err);
  }
};
