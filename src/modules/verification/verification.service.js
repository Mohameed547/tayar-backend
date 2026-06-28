import Verification, {
    VERIFICATION_STATUS,
} from "../../database/models/Verification.model.js";
import ApiError from "../../shared/utils/ApiError.js";

const uploadDocument = async (userId, { documentType, documentUrl }) => {
    let verification = await Verification.findOne({ user: userId });

    if (!verification) {
        verification = await Verification.create({
            user: userId,
            documents: [],
        });
    }

    const existingIndex = verification.documents.findIndex(
        (d) => d.documentType === documentType,
    );
    if (existingIndex >= 0) {
        verification.documents[existingIndex] = {
            documentType,
            documentUrl,
            uploadedAt: new Date(),
        };
    } else {
        verification.documents.push({ documentType, documentUrl });
    }

    if (verification.status === VERIFICATION_STATUS.REJECTED) {
        verification.status = VERIFICATION_STATUS.PENDING;
        verification.reviewNote = null;
    }

    await verification.save();
    return verification;
};

const getStatus = async (userId) => {
    const verification = await Verification.findOne({ user: userId });
    if (!verification) {
        return {
            status: VERIFICATION_STATUS.PENDING,
            documents: [],
            reviewNote: null,
        };
    }
    return verification;
};

// ✅ بدل getAllPending — بقت getAll وبتقبل status فلتر
const getAll = async (status = "all") => {
    const query = status && status !== "all" ? { status } : {};

    const verifications = await Verification.find(query)
        .populate("user", "fullName email phone role")
        .sort({ createdAt: -1 })
        .lean();

    return verifications
        .filter((v) => v.user)
        .map((v) => ({
            id: v._id,
            userId: v.user._id,
            name: v.user.fullName,
            email: v.user.email,
            phone: v.user.phone,
            role: v.user.role,
            status: v.status,
            documents: v.documents,
            reviewNote: v.reviewNote,
            createdAt: v.createdAt,
        }));
};

const reviewVerification = async (
    reviewerId,
    userId,
    { status, reviewNote },
) => {
    if (!Object.values(VERIFICATION_STATUS).includes(status)) {
        throw ApiError.badRequest("Invalid verification status");
    }

    const verification = await Verification.findOne({ user: userId });
    if (!verification)
        throw ApiError.notFound(
            "No verification submission found for this user",
        );

    verification.status = status;
    verification.reviewNote = reviewNote ?? null;
    verification.reviewedBy = reviewerId;
    verification.reviewedAt = new Date();
    await verification.save();

    return verification;
};

export default { uploadDocument, getStatus, getAll, reviewVerification };
