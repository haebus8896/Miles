const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true, index: true },
    phone: { type: String, required: true, index: true },
    otp_hash: { type: String, required: true },
    expires_at: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    channel: { type: String, enum: ['sms', 'test'], default: 'test' }
  },
  { timestamps: true }
);

OtpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', OtpSchema);

