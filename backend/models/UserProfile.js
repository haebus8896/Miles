const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema(
    {
        encryptedName: { type: String, required: true },
        encryptedPhone: { type: String, required: true, unique: true },
        linkedHouseholdProfiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'HouseholdProfile' }],
        verificationStatus: { type: String, enum: ['verified', 'unverified'], default: 'unverified' }
    },
    { timestamps: true }
);

module.exports = mongoose.model('UserProfile', UserProfileSchema);
