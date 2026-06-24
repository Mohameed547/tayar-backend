import Shipment from "../../database/models/Shipment.model.js";
import Driver from "../../database/models/Driver.js";
import Office from "../../database/models/Office.js";
import { SHIPMENT_STATUS } from "../../shared/constants/shipmentStatus.js";
import ApiError from "../../shared/utils/ApiError.js";

const dayStart = (daysAgo) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d;
};

const sumEarnings = async (matchExtra) => {
    const [daily, weekly, monthly, total] = await Promise.all([
        Shipment.aggregate([
            { $match: { ...matchExtra, status: SHIPMENT_STATUS.DELIVERED, updatedAt: { $gte: dayStart(0) } } },
            { $group: { _id: null, sum: { $sum: "$estimatedPriceMax" } } },
        ]),
        Shipment.aggregate([
            { $match: { ...matchExtra, status: SHIPMENT_STATUS.DELIVERED, updatedAt: { $gte: dayStart(7) } } },
            { $group: { _id: null, sum: { $sum: "$estimatedPriceMax" } } },
        ]),
        Shipment.aggregate([
            { $match: { ...matchExtra, status: SHIPMENT_STATUS.DELIVERED, updatedAt: { $gte: dayStart(30) } } },
            { $group: { _id: null, sum: { $sum: "$estimatedPriceMax" } } },
        ]),
        Shipment.aggregate([
            { $match: { ...matchExtra, status: SHIPMENT_STATUS.DELIVERED } },
            { $group: { _id: null, sum: { $sum: "$estimatedPriceMax" } } },
        ]),
    ]);

    return {
        daily: daily[0]?.sum ?? 0,
        weekly: weekly[0]?.sum ?? 0,
        monthly: monthly[0]?.sum ?? 0,
        total: total[0]?.sum ?? 0,
    };
};

const getCaptainEarnings = async (userId) => {
    return sumEarnings({ captain: userId });
};

const getOfficeEarnings = async (officeUserId) => {
    const office = await Office.findOne({ user: officeUserId });
    if (!office) throw ApiError.notFound("Office profile not found");

    const captainDrivers = await Driver.find({ officeId: office._id }).select("user");
    const captainUserIds = captainDrivers.map((d) => d.user);

    return sumEarnings({ captain: { $in: captainUserIds }, assignedOffice: office._id });
};

export default { getCaptainEarnings, getOfficeEarnings };
