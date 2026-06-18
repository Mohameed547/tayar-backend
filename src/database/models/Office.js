import mongoose from 'mongoose';
const officeSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    businessName: String,
    licenseNumber: String,
    address: Object
});
export default mongoose.model('Office', officeSchema);