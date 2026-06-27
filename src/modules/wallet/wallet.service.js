import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import {
    Wallet,
    Transaction,
    USER_TYPE,
    WALLET_STATUS,
    TRANSACTION_TYPE,
    TRANSACTION_PURPOSE,
    TRANSACTION_STATUS,
    GATEWAY,
} from "../../database/models/Wallet.model.js";
import ApiError from "../../shared/utils/ApiError.js";
import { getPagination } from "../../shared/utils/pagination.js";

const ROLE_TO_USER_TYPE = {
    customer: USER_TYPE.CUSTOMER,
    driver: USER_TYPE.DRIVER,
    office: USER_TYPE.OFFICE,
};

const mapRoleToUserType = (role) => {
    const userType = ROLE_TO_USER_TYPE[role];
    if (!userType) {
        throw new ApiError(400, `Unsupported account role for wallet: ${role}`);
    }
    return userType;
};

const generateReferenceId = (prefix) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// دالة مشتركة لتجهيز الدفع عبر محافظ Paymob
const initPaymobWalletPayment = async (amount, payload) => {
    try {
        // 1. Authentication
        const authRes = await axios.post("https://accept.paymob.com/api/auth/tokens", {
            api_key: process.env.PAYMOB_API_KEY,
        });
        const authToken = authRes.data.token;

        // 2. Register Order (المبلغ بالقروش، نضرب في 100)
        const orderRes = await axios.post("https://accept.paymob.com/api/ecommerce/orders", {
            auth_token: authToken,
            delivery_needed: "false",
            amount_cents: amount * 100,
            currency: "EGP",
        });
        const orderId = orderRes.data.id;

        // 3. Create Payment Key
        const paymentKeyRes = await axios.post("https://accept.paymob.com/api/acceptance/payment_keys", {
            auth_token: authToken,
            amount_cents: amount * 100,
            expiration: 3600,
            order_id: orderId,
            billing_data: {
                apartment: "NA", floor: "NA", street: "NA", building: "NA", postal_code: "NA", city: "Cairo", country: "EG",
                email: payload.metadata?.email || "customer@app.com",
                first_name: payload.metadata?.firstName || "Wallet", last_name: payload.metadata?.lastName || "User",
                phone_number: payload.metadata?.phone || "01000000000",
            },
            currency: "EGP",
            integration_id: process.env.PAYMOB_WALLET_INTEGRATION_ID,
        });
        const paymentToken = paymentKeyRes.data.token;

        // 4. Get Redirection URL
        const walletPayRes = await axios.post("https://accept.paymob.com/api/acceptance/payments/pay", {
            source: {
                identifier: payload.metadata?.phone,
                subtype: "WALLET",
            },
            payment_token: paymentToken,
        });

        return {
            success: true,
            providerReference: orderId.toString(),
            redirectUrl: walletPayRes.data.iframe_redirection_url,
        };
    } catch (error) {
        console.error("Paymob API Integration Error:", error.response?.data || error.message);
        return { success: false };
    }
};

const GATEWAY_HANDLERS = {
    [GATEWAY.VODAFONE_CASH]: async (amount, payload) => initPaymobWalletPayment(amount, payload),
    [GATEWAY.ORANGE_CASH]: async (amount, payload) => initPaymobWalletPayment(amount, payload),
    [GATEWAY.ETISALAT_CASH]: async (amount, payload) => initPaymobWalletPayment(amount, payload),
    [GATEWAY.INSTAPAY]: async (amount, payload) => ({
        success: true,
        providerReference: generateReferenceId("INSTAPAY"),
    }),
    [GATEWAY.APPLE_PAY]: async (amount, payload) => ({
        success: true,
        providerReference: generateReferenceId("APPLEPAY"),
    }),
};

const chargeGateway = async (gateway, amount, payload) => {
    const handler = GATEWAY_HANDLERS[gateway];
    if (!handler) {
        throw new ApiError(400, `Unsupported payment gateway: ${gateway}`);
    }

    const result = await handler(amount, payload);
    if (!result?.success) {
        throw new ApiError(502, "The payment gateway declined or failed to process this request");
    }
    return result;
};

const getOrCreateWallet = async (userId, role, session = null) => {
    const userType = mapRoleToUserType(role);
    const options = session ? { session } : {};

    let wallet = await Wallet.findOne({ userId }).session(session ?? null);
    if (!wallet) {
        const created = await Wallet.create([{ userId, userType }], options);
        wallet = Array.isArray(created) ? created[0] : created;
    }
    return wallet;
};

const assertWalletIsActive = (wallet) => {
    if (wallet.status !== WALLET_STATUS.ACTIVE) {
        throw new ApiError(403, "This wallet is locked and cannot send or receive funds");
    }
};

const withWalletTransaction = async (work) => {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await work(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
};

const getWalletBalance = async (userId, role) => {
    const wallet = await getOrCreateWallet(userId, role);
    return wallet;
};

const getTransactionHistory = async (userId, role, { page, limit, type, purpose, status } = {}) => {
    const wallet = await getOrCreateWallet(userId, role);
    const { skip, take } = getPagination(page, limit);

    const filter = { walletId: wallet._id };
    if (type) filter.type = type;
    if (purpose) filter.purpose = purpose;
    if (status) filter.status = status;

    const [transactions, total] = await Promise.all([
        Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take),
        Transaction.countDocuments(filter),
    ]);

    return {
        wallet,
        transactions,
        total,
        page: Number(page) || 1,
        limit: take,
    };
};

const handleTopUp = async (userId, role, { amount, gateway, referenceId, metadata = {} }) => {
    return withWalletTransaction(async (session) => {
        const wallet = await getOrCreateWallet(userId, role, session);
        assertWalletIsActive(wallet);

        const gatewayResult = await chargeGateway(gateway, amount, { userId, metadata });

        // المعاملة تنشأ PENDING ولن يتم تزويد الرصيد هنا بل في الـ Webhook
        const [transaction] = await Transaction.create(
            [
                {
                    walletId: wallet._id,
                    type: TRANSACTION_TYPE.CREDIT,
                    purpose: TRANSACTION_PURPOSE.TOPUP,
                    amount,
                    gateway,
                    status: TRANSACTION_STATUS.PENDING,
                    referenceId: referenceId || gatewayResult.providerReference,
                    metadata: { ...metadata, redirectUrl: gatewayResult.redirectUrl },
                    balanceAfter: wallet.balance,
                },
            ],
            { session },
        );

        return { wallet, transaction, redirectUrl: gatewayResult.redirectUrl };
    });
};

// الدالة المسؤولة عن تأكيد الشحن الفعلي وزيادة رصيد المحفظة عند استقبال إشارة الـ Webhook من Paymob
const confirmTopUp = async (orderId, amount) => {
    return withWalletTransaction(async (session) => {
        const transaction = await Transaction.findOne({
            referenceId: orderId,
            status: TRANSACTION_STATUS.PENDING,
        }).session(session);

        if (!transaction) return null;

        const wallet = await Wallet.findById(transaction.walletId).session(session);
        if (!wallet) return null;

        wallet.balance += amount;
        await wallet.save({ session });

        transaction.status = TRANSACTION_STATUS.COMPLETED;
        transaction.balanceAfter = wallet.balance;
        await transaction.save({ session });

        return { wallet, transaction };
    });
};

const handleInternalPayment = async (
    fromUserId,
    fromRole,
    { toUserId, toUserType, amount, purpose, referenceId, metadata = {} },
) => {
    return withWalletTransaction(async (session) => {
        const fromWallet = await getOrCreateWallet(fromUserId, fromRole, session);
        assertWalletIsActive(fromWallet);

        if (fromWallet.userType !== USER_TYPE.CUSTOMER) {
            throw new ApiError(403, "Only customer wallets can initiate this kind of payment");
        }

        if (fromWallet.balance < amount) {
            throw new ApiError(400, "Insufficient wallet balance");
        }

        if (String(fromWallet.userId) === String(toUserId)) {
            throw new ApiError(400, "Cannot pay your own wallet");
        }

        let toWallet = await Wallet.findOne({ userId: toUserId }).session(session);
        if (!toWallet) {
            const created = await Wallet.create([{ userId: toUserId, userType: toUserType }], { session });
            toWallet = created[0];
        }
        assertWalletIsActive(toWallet);

        if (toWallet.userType !== toUserType) {
            throw new ApiError(400, "Recipient account type does not match the request");
        }

        fromWallet.balance -= amount;
        toWallet.balance += amount;

        await fromWallet.save({ session });
        await toWallet.save({ session });

        const sharedReferenceId = referenceId || generateReferenceId("PAY");

        const [debitTransaction, creditTransaction] = await Transaction.create(
            [
                {
                    walletId: fromWallet._id,
                    type: TRANSACTION_TYPE.DEBIT,
                    purpose,
                    amount,
                    gateway: GATEWAY.INTERNAL,
                    status: TRANSACTION_STATUS.COMPLETED,
                    referenceId: sharedReferenceId,
                    metadata: { ...metadata, counterpartyWalletId: toWallet._id },
                    balanceAfter: fromWallet.balance,
                },
                {
                    walletId: toWallet._id,
                    type: TRANSACTION_TYPE.CREDIT,
                    purpose,
                    amount,
                    gateway: GATEWAY.INTERNAL,
                    status: TRANSACTION_STATUS.COMPLETED,
                    referenceId: sharedReferenceId,
                    metadata: { ...metadata, counterpartyWalletId: fromWallet._id },
                    balanceAfter: toWallet.balance,
                },
            ],
            { session },
        );

        return { fromWallet, toWallet, debitTransaction, creditTransaction };
    });
};

const requestWithdrawal = async (
    userId,
    role,
    { amount, destination, bankAccount, mobileWalletNumber },
) => {
    return withWalletTransaction(async (session) => {
        const wallet = await getOrCreateWallet(userId, role, session);
        assertWalletIsActive(wallet);

        if (![USER_TYPE.DRIVER, USER_TYPE.OFFICE].includes(wallet.userType)) {
            throw new ApiError(403, "Only driver or office wallets can request a withdrawal");
        }

        if (wallet.balance < amount) {
            throw new ApiError(400, "Insufficient wallet balance for this withdrawal");
        }

        wallet.balance -= amount;
        await wallet.save({ session });

        const [transaction] = await Transaction.create(
            [
                {
                    walletId: wallet._id,
                    type: TRANSACTION_TYPE.DEBIT,
                    purpose: TRANSACTION_PURPOSE.WITHDRAWAL,
                    amount,
                    gateway: GATEWAY.INTERNAL,
                    status: TRANSACTION_STATUS.PENDING,
                    referenceId: generateReferenceId("WD"),
                    metadata: { destination, bankAccount, mobileWalletNumber },
                    balanceAfter: wallet.balance,
                },
            ],
            { session },
        );

        return { wallet, transaction };
    });
};

export default {
    getWalletBalance,
    getTransactionHistory,
    handleTopUp,
    confirmTopUp,
    handleInternalPayment,
    requestWithdrawal,
};