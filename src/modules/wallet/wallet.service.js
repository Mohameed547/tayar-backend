import Wallet, {
    TRANSACTION_TYPE,
} from "../../database/models/Wallet.model.js";
import ApiError from "../../shared/utils/ApiError.js";
import { getPagination } from "../../shared/utils/pagination.js";

const getOrCreateWallet = async (userId) => {
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) wallet = await Wallet.create({ user: userId });
    return wallet;
};

const getWallet = async (userId) => {
    return await getOrCreateWallet(userId);
};

const topup = async (userId, amount) => {
    if (!amount || amount <= 0) throw new ApiError(400, "Invalid amount");

    const wallet = await getOrCreateWallet(userId);

    wallet.balance += amount;
    wallet.transactions.push({
        type: TRANSACTION_TYPE.TOPUP,
        amount,
        description: `Top-up of ${amount} EGP`,
    });

    await wallet.save();
    return wallet;
};

const withdraw = async (userId, amount) => {
    if (!amount || amount <= 0) throw new ApiError(400, "Invalid amount");

    const wallet = await getOrCreateWallet(userId);

    if (amount > wallet.balance)
        throw new ApiError(400, "Insufficient balance");

    wallet.balance -= amount;
    wallet.transactions.push({
        type: TRANSACTION_TYPE.PAYMENT,
        amount,
        description: `Withdrawal of ${amount} EGP`,
    });

    await wallet.save();
    return wallet;
};

const getTransactions = async (userId, { page, limit }) => {
    const { skip, take } = getPagination(page, limit);

    const wallet = await getOrCreateWallet(userId);

    const transactions = wallet.transactions
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(skip, skip + take);

    return {
        transactions,
        total: wallet.transactions.length,
        page: Number(page) || 1,
        limit: take,
    };
};

const processPayment = async (userId, amount, reference) => {
    const CASHBACK_RATE = 0.05;

    const wallet = await getOrCreateWallet(userId);

    if (amount > wallet.balance)
        throw new ApiError(400, "Insufficient balance");

    const cashback = Math.round(amount * CASHBACK_RATE);

    wallet.balance -= amount;
    wallet.balance += cashback;
    wallet.cashbackEarned += cashback;

    wallet.transactions.push({
        type: TRANSACTION_TYPE.PAYMENT,
        amount,
        description: `Payment for shipment`,
        reference,
    });

    wallet.transactions.push({
        type: TRANSACTION_TYPE.CASHBACK,
        amount: cashback,
        description: `5% cashback on shipment payment`,
        reference,
    });

    await wallet.save();
    return wallet;
};

export default {
    getWallet,
    topup,
    withdraw,
    getTransactions,
    processPayment,
};
