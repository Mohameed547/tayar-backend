import walletService from "./wallet.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";

export const getWallet = async (req, res, next) => {
    try {
        const wallet = await walletService.getWallet(req.user._id);
        return res.status(200).json(ApiResponse.success(wallet));
    } catch (err) {
        next(err);
    }
};

export const topup = async (req, res, next) => {
    try {
        const wallet = await walletService.topup(req.user._id, req.body.amount);
        return res
            .status(200)
            .json(ApiResponse.success(wallet, "Top-up successful"));
    } catch (err) {
        next(err);
    }
};

export const withdraw = async (req, res, next) => {
    try {
        const wallet = await walletService.withdraw(
            req.user._id,
            req.body.amount,
        );
        return res
            .status(200)
            .json(ApiResponse.success(wallet, "Withdrawal successful"));
    } catch (err) {
        next(err);
    }
};

export const getTransactions = async (req, res, next) => {
    try {
        const { page, limit } = req.query;
        const result = await walletService.getTransactions(req.user._id, {
            page,
            limit,
        });
        return res.status(200).json(ApiResponse.success(result));
    } catch (err) {
        next(err);
    }
};
