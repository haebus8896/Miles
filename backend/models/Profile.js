const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema(
  {
    address: { type: mongoose.Schema.Types.ObjectId, ref: 'Address', required: true, index: true },
    name_masked: { type: String, required: true },
    phone_masked: { type: String, required: true },
    name_encrypted: { type: String, required: true },
    phone_encrypted: { type: String, required: true },
    relation: { type: String, default: 'primary' },
    verifiedAt: { type: Date },
    otp_reference: { type: String },
    is_default: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Profile', ProfileSchema);
