const mongoose = require('mongoose');

const DeliverySessionSchema = new mongoose.Schema(
  {
    address: { type: mongoose.Schema.Types.ObjectId, ref: 'Address', required: true },
    delivery_partner_id: { type: String, required: true },
    mode: { type: String, enum: ['GOOGLE_ONLY', 'SMART_NAV'], required: true },
    started_at: { type: Date, default: Date.now },
    completed_at: { type: Date },
    metrics: {
      duration_seconds: { type: Number, default: 0 },
      customer_calls: { type: Number, default: 0 },
      wrong_lane_attempts: { type: Number, default: 0 },
      distance_meters: { type: Number, default: 0 }
    },
    notes: { type: String, default: '' },
    a_b_bucket: { type: String, enum: ['A', 'B'], default: 'B' }
  },
  { timestamps: true }
);

DeliverySessionSchema.index({ delivery_partner_id: 1, createdAt: -1 });

module.exports = mongoose.model('DeliverySession', DeliverySessionSchema);

