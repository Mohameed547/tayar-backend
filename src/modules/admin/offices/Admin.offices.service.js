import Office from "../../../database/models/Office.js";
import User from "../../../database/models/User.model.js";
import Driver from "../../../database/models/Driver.js";
import Shipment from "../../../database/models/Shipment.model.js";
import Review from "../../../database/models/Review.model.js";
import ApiError from "../../../shared/utils/ApiError.js";

const formatOffice = (office, user, ordersCount = 0, rating = 0) => ({
    id: office._id,
    initials: user.fullName
        ?.split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    name: user.fullName,
    email: user.email,
    phone: user.phone,
    address: office.address?.text ?? null,
    status: user.status,
    rating,
    orders: ordersCount,
    joinedAt: new Date(office.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }),
});

/**
 * Office rating is now derived directly from reviews where the office
 * itself is the reviewee:
 *   Review.reviewee === office.user (the Office's own User._id)
 *   Review.revieweeType === "Office"
 *
 * Orders are still derived through the office's captains (drivers), since
 * shipments are linked to a captain (driver), not to an office directly:
 *   Office._id -> Driver.officeId -> Driver.user (captain's User._id)
 *   orders = count of Shipments where captain is one of those user ids
 *
 * This builds one lookup map keyed by officeId so a whole page of offices
 * can be enriched with a constant number of queries instead of N+1.
 */
const buildOfficeMetricsMap = async (officeIds, officeUserIds) => {
    const [drivers, officeReviews] = await Promise.all([
        Driver.find({ officeId: { $in: officeIds } })
            .select("officeId user")
            .lean(),
        Review.find({
            reviewee: { $in: officeUserIds },
            revieweeType: "Office",
        })
            .select("reviewee rating")
            .lean(),
    ]);

    const driverUserIds = drivers.map((d) => d.user);

    const shipmentCounts = driverUserIds.length
        ? await Shipment.aggregate([
              { $match: { captain: { $in: driverUserIds } } },
              { $group: { _id: "$captain", count: { $sum: 1 } } },
          ])
        : [];

    const ordersByUser = Object.fromEntries(
        shipmentCounts.map((s) => [s._id.toString(), s.count]),
    );

    // orders per office, via its drivers
    const ordersByOffice = {};
    drivers.forEach(({ officeId, user: userId }) => {
        const officeKey = officeId.toString();
        const userKey = userId.toString();
        ordersByOffice[officeKey] =
            (ordersByOffice[officeKey] ?? 0) + (ordersByUser[userKey] ?? 0);
    });

    // ratings per office, via reviews made directly against the office's own user id
    const ratingsByOfficeUser = {};
    officeReviews.forEach((r) => {
        const key = r.reviewee.toString();
        if (!ratingsByOfficeUser[key]) ratingsByOfficeUser[key] = [];
        ratingsByOfficeUser[key].push(r.rating);
    });

    const result = {};
    officeIds.forEach((officeId, idx) => {
        const officeKey = officeId.toString();
        const officeUserKey = officeUserIds[idx].toString();
        const ratings = ratingsByOfficeUser[officeUserKey] ?? [];
        const avgRating = ratings.length
            ? Number(
                  (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(
                      1,
                  ),
              )
            : 0;

        result[officeKey] = {
            orders: ordersByOffice[officeKey] ?? 0,
            rating: avgRating,
        };
    });

    return result;
};

/**
 * getOffices: جلب جدول المكاتب بس (مفلتر/مبحوث/مرقّم).
 * مبقتش بتحسب stats هنا — الـ stats بقت endpoint مستقل (getStats)
 * عشان الفلترة والبحث يفضلوا سريعين وما يعيدوا حساب أرقام عامة
 * مفيهاش علاقة بالفلتر نفسه.
 */
const getOffices = async ({ search, status, page = 1, limit = 20 }) => {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // ── Build user filter ──
    const userFilter = { role: "office" };
    if (status && status !== "all") userFilter.status = status;
    if (search?.trim()) {
        const regex = new RegExp(search.trim(), "i");
        userFilter.$or = [
            { fullName: regex },
            { email: regex },
            { phone: regex },
        ];
    }

    const matchingUsers = await User.find(userFilter)
        .select("_id fullName email phone status")
        .lean();
    const userIds = matchingUsers.map((u) => u._id);
    const usersMap = Object.fromEntries(
        matchingUsers.map((u) => [u._id.toString(), u]),
    );

    if (userIds.length === 0) {
        return {
            offices: [],
            pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 },
        };
    }

    const [offices, total] = await Promise.all([
        Office.find({ user: { $in: userIds } })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Office.countDocuments({ user: { $in: userIds } }),
    ]);

    const officeIds = offices.map((o) => o._id);
    const officeUserIds = offices.map((o) => o.user);
    const metricsByOffice = await buildOfficeMetricsMap(
        officeIds,
        officeUserIds,
    );

    return {
        offices: offices.map((o) => {
            const user = usersMap[o.user.toString()];
            const metrics = metricsByOffice[o._id.toString()] ?? {
                orders: 0,
                rating: 0,
            };
            return formatOffice(o, user, metrics.orders, metrics.rating);
        }),
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
        },
    };
};

/**
 * getStats: الإحصائيات العامة بس (Total, Active, Suspended, Avg rating).
 * مستقلة عن أي فلتر/بحث في الجدول — بتتحسب لوحدها ومفيش لازمة تتكرر
 * كل ما المستخدم يغيّر فلتر الجدول.
 */
const getStats = async () => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const [total, active, suspended, newThisMonth, offices] = await Promise.all(
        [
            User.countDocuments({ role: "office" }),
            User.countDocuments({ role: "office", status: "active" }),
            User.countDocuments({ role: "office", status: "suspended" }),
            User.countDocuments({
                role: "office",
                createdAt: { $gte: oneMonthAgo },
            }),
            Office.find().select("_id user").lean(),
        ],
    );

    // Platform-wide average rating: derived across every office's own reviews.
    const officeIds = offices.map((o) => o._id);
    const officeUserIds = offices.map((o) => o.user);
    const metricsByOffice = await buildOfficeMetricsMap(
        officeIds,
        officeUserIds,
    );
    const allRatings = Object.values(metricsByOffice)
        .map((m) => m.rating)
        .filter((r) => r > 0);
    const avgRating = allRatings.length
        ? Number(
              (
                  allRatings.reduce((a, b) => a + b, 0) / allRatings.length
              ).toFixed(1),
          )
        : 0;

    return {
        total,
        active,
        suspended,
        avgRating,
        monthTrend: newThisMonth,
    };
};

const getOfficeById = async (id) => {
    const office = await Office.findById(id).lean();
    if (!office) throw new ApiError(404, "Office not found");

    const user = await User.findById(office.user)
        .select("fullName email phone status")
        .lean();
    if (!user) throw new ApiError(404, "Office user not found");

    const metricsByOffice = await buildOfficeMetricsMap(
        [office._id],
        [office.user],
    );
    const metrics = metricsByOffice[office._id.toString()] ?? {
        orders: 0,
        rating: 0,
    };

    return formatOffice(office, user, metrics.orders, metrics.rating);
};

const updateOfficeStatus = async (id, status) => {
    const office = await Office.findById(id).lean();
    if (!office) throw new ApiError(404, "Office not found");

    const user = await User.findByIdAndUpdate(
        office.user,
        { status },
        { new: true },
    );

    if (status === "active") {
        const Verification = (await import("../../../database/models/Verification.model.js")).default;
        await Verification.findOneAndUpdate(
            { user: office.user },
            { status: "approved" },
            { upsert: true }
        );
    } else if (status === "pending" || status === "suspended") {
        const Verification = (await import("../../../database/models/Verification.model.js")).default;
        await Verification.findOneAndUpdate(
            { user: office.user },
            { status: status === "pending" ? "pending" : "rejected" }
        );
    }

    return { id: office._id, status: user.status };
};

export default { getOffices, getStats, getOfficeById, updateOfficeStatus };
