const mongoose = require('mongoose');

const deliverySessionSchema = new mongoose.Schema({
    tenant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    session_id: { type: String, required: true, unique: true }, // e.g. "ORD-123" or UUID
    rider_id: String,

    status: {
        type: String,
        enum: ['active', 'paused', 'completed', 'cancelled'],
        default: 'active'
    },

    // Real-time snapshot
    current_location: {
        lat: Number,
        lng: Number,
        speed: Number, // m/s
        bearing: Number,
        timestamp: Date
    },

    metadata: {
        order_id: String,
        customer_name: String
    },

    start_time: { type: Date, default: Date.now },
    end_time: Date
}, {
    timestamps: true
});

module.exports = mongoose.model('DeliverySession', deliverySessionSchema);
