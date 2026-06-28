import mongoose from "mongoose";
import Shipment from "../../database/models/Shipment.model.js";
import Driver from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";
import { Wallet, Transaction } from "../../database/models/Wallet.model.js";
import Escrow from "../../database/models/Escrow.model.js";
import ApiError from "../../shared/utils/ApiError.js";

const getStartOfMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getStartOfDay = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

const getCaptainEarnings = async (userId) => {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return { daily: 0, weekly: 0, monthly: 0, total: 0, withdrawn: 0, platformFees: 0 };

    const startOfMonth = getStartOfMonth();
    const startOfDay = getStartOfDay();

    // 1. Calculate earnings
    const earningsAggregation = await Transaction.aggregate([
        {
            $match: {
                walletId: wallet._id,
                type: "Credit",
                purpose: "Earning",
                status: "Completed"
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$amount" },
                monthly: {
                    $sum: {
                        $cond: [{ $gte: ["$createdAt", startOfMonth] }, "$amount", 0]
                    }
                },
                daily: {
                    $sum: {
                        $cond: [{ $gte: ["$createdAt", startOfDay] }, "$amount", 0]
                    }
                }
            }
        }
    ]);

    const stats = earningsAggregation[0] || { total: 0, monthly: 0, daily: 0 };

    // 2. Calculate withdrawn earnings
    const withdrawalAggregation = await Transaction.aggregate([
        {
            $match: {
                walletId: wallet._id,
                type: "Debit",
                purpose: "Withdrawal",
                status: "Completed"
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$amount" }
            }
        }
    ]);

    const withdrawn = withdrawalAggregation[0]?.total || 0;

    // 3. Platform fees
    const platformFeesAggregation = await Escrow.aggregate([
        {
            $match: {
                driver: new mongoose.Types.ObjectId(userId),
                status: "released"
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$commissionAmount" }
            }
        }
    ]);

    const platformFees = platformFeesAggregation[0]?.total || 0;

    return {
        daily: stats.daily || 0,
        weekly: stats.monthly || 0,
        monthly: stats.monthly || 0,
        total: stats.total || 0,
        withdrawn,
        platformFees
    };
};

const getOfficeEarnings = async (officeUserId) => {
    const office = await Office.findOne({ user: officeUserId });
    if (!office) throw ApiError.notFound("Office profile not found");

    const wallet = await Wallet.findOne({ userId: officeUserId });
    if (!wallet) return { daily: 0, weekly: 0, monthly: 0, total: 0, withdrawn: 0, platformFees: 0 };

    const startOfMonth = getStartOfMonth();
    const startOfDay = getStartOfDay();

    // 1. Calculate earnings
    const earningsAggregation = await Transaction.aggregate([
        {
            $match: {
                walletId: wallet._id,
                type: "Credit",
                purpose: "Earning",
                status: "Completed"
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$amount" },
                monthly: {
                    $sum: {
                        $cond: [{ $gte: ["$createdAt", startOfMonth] }, "$amount", 0]
                    }
                },
                daily: {
                    $sum: {
                        $cond: [{ $gte: ["$createdAt", startOfDay] }, "$amount", 0]
                    }
                }
            }
        }
    ]);

    const stats = earningsAggregation[0] || { total: 0, monthly: 0, daily: 0 };

    // 2. Calculate withdrawn earnings
    const withdrawalAggregation = await Transaction.aggregate([
        {
            $match: {
                walletId: wallet._id,
                type: "Debit",
                purpose: "Withdrawal",
                status: "Completed"
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$amount" }
            }
        }
    ]);

    const withdrawn = withdrawalAggregation[0]?.total || 0;

    // 3. Platform fees for shipments assigned to this office
    const platformFeesAggregation = await Escrow.aggregate([
        {
            $lookup: {
                from: "escrows",
                localField: "_id",
                foreignField: "shipment",
                as: "escrowDoc"
            }
        },
        {
            $lookup: {
                from: "shipments",
                let: { id: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$_id", "$$id"] }, assignedOffice: office._id } }
                ],
                as: "shipmentDoc"
            }
        },
        {
            $match: {
                "shipmentDoc.0": { $exists: true }
            }
        },
        {
            $unwind: "$escrowDoc"
        },
        {
            $match: {
                "escrowDoc.status": "released"
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$escrowDoc.commissionAmount" }
            }
        }
    ]);

    const platformFees = platformFeesAggregation[0]?.total || 0;

    return {
        daily: stats.daily || 0,
        weekly: stats.monthly || 0,
        monthly: stats.monthly || 0,
        total: stats.total || 0,
        withdrawn,
        platformFees
    };
};

export default { getCaptainEarnings, getOfficeEarnings };
