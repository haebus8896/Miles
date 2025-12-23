const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
    encryptedName: { type: String, required: true },
    encryptedPhone: { type: String, required: true },
    relationship: { type: String },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date }
}, { _id: false });

const HouseholdProfileSchema = new mongoose.Schema(
    {
        addressId: { type: mongoose.Schema.Types.ObjectId, ref: 'AddressRecord', required: true },
        primaryResident: {
            encryptedName: { type: String, required: true },
            encryptedPhone: { type: String, required: true },
            verified: { type: Boolean, default: true },
            verifiedAt: { type: Date, default: Date.now }
        },
        members: [MemberSchema],
        maskedDisplayData: {
            primary: {
                maskedName: { type: String },
                maskedPhone: { type: String }
            },
            members: [{
                maskedName: { type: String },
                maskedPhone: { type: String },
                relationship: { type: String }
            }]
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('HouseholdProfile', HouseholdProfileSchema);
