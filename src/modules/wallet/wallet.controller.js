import walletService from "./wallet.service.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";
import asyncHandler from "../../shared/utils/asyncHandler.js";

export const getWalletBalance = asyncHandler(async (req, res) => {
    const wallet = await walletService.getWalletBalance(req.user._id, req.user.role);
    return res.status(200).json(ApiResponse.success(wallet));
});

export const getTransactionHistory = asyncHandler(async (req, res) => {
    const { page, limit, type, purpose, status } = req.query;
    const result = await walletService.getTransactionHistory(req.user._id, req.user.role, {
        page,
        limit,
        type,
        purpose,
        status,
    });
    return res.status(200).json(ApiResponse.success(result));
});

export const handleTopUp = asyncHandler(async (req, res) => {
    const { amount, gateway, referenceId, metadata } = req.body;
    const { wallet, transaction, redirectUrl } = await walletService.handleTopUp(req.user._id, req.user.role, {
        amount,
        gateway,
        referenceId,
        metadata,
    });
    return res.status(200).json(
        ApiResponse.success({ wallet, transaction, redirectUrl }, "Top-up initialized. Redirect the user to the redirectUrl."),
    );
});

// الـ Controller المسؤول عن استقبال إشعار الدفع من Paymob وتأكيد شحن الحساب
export const handlePaymobWebhook = asyncHandler(async (req, res) => {
    const { obj } = req.body;

    if (obj && obj.success === true) {
        const orderId = obj.order.id.toString();
        const amount = obj.amount_cents / 100; // تحويل من قروش إلى جنيهات

        await walletService.confirmTopUp(orderId, amount);
    }

    // الرد بـ 200 ضروري جداً لـ Paymob لإنهاء إرسال الطلبات
    return res.status(200).send("OK");
});

export const handleInternalPayment = asyncHandler(async (req, res) => {
    const { toUserId, toUserType, amount, purpose, referenceId, metadata } = req.body;
    const { fromWallet, toWallet, debitTransaction, creditTransaction } =
        await walletService.handleInternalPayment(req.user._id, req.user.role, {
            toUserId,
            toUserType,
            amount,
            purpose,
            referenceId,
            metadata,
        });

    return res.status(200).json(
        ApiResponse.success(
            { fromWallet, toWallet, debitTransaction, creditTransaction },
            "Payment completed successfully",
        ),
    );
});

export const requestWithdrawal = asyncHandler(async (req, res) => {
    const { amount, destination, bankAccount, mobileWalletNumber } = req.body;
    const { wallet, transaction } = await walletService.requestWithdrawal(req.user._id, req.user.role, {
        amount,
        destination,
        bankAccount,
        mobileWalletNumber,
    });

    return res.status(200).json(
        ApiResponse.success({ wallet, transaction }, "Withdrawal request submitted and is pending processing"),
    );
});