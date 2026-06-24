import mongoose from 'mongoose';

export const CAPTAIN_STATUS = {
    ONLINE: 'online',
    OFFLINE: 'offline',
    BUSY: 'busy',
    AVAILABLE: 'available',
};

const driverSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vehicle: { type: Object },

    // --- Added for office module ---
    // Office that owns/manages this captain. null => independent captain.
    officeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Office', default: null },
    status: {
        type: String,
        enum: Object.values(CAPTAIN_STATUS),
        default: CAPTAIN_STATUS.OFFLINE,
    },
    isActive: { type: Boolean, default: true },
    lastLocation: {
        coords: { type: [Number], default: undefined },
        updatedAt: { type: Date, default: null },
    },
    lastActiveAt: { type: Date, default: null },
}, { timestamps: true });

driverSchema.index({ officeId: 1 });

export default mongoose.model('Driver', driverSchema);