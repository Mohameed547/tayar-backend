import mongoose from 'mongoose';
const driverSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vehicle: { type: Object }
});
export default mongoose.model('Driver', driverSchema);