import mongoose from 'mongoose';
const walletSchema = new mongoose.Schema({
    ownerType: { type: String, enum: ['User', 'Driver', 'Office'] },
    owner: { type: mongoose.Schema.Types.ObjectId, refPath: 'ownerType' },
    balance: { type: Number, default: 0 }
});
export default mongoose.model('Wallet', walletSchema);