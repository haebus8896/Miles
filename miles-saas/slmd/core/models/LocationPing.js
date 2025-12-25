const mongoose = require('mongoose');

const locationPingSchema = new mongoose.Schema({
    tenant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },

    session_id: { type: String, required: true, index: true },

    lat: { type: Number, required: true },
    lng: { type: Number, required: true },

    accuracy: Number,
    speed: Number,
    bearing: Number,
    battery_level: Number,

    timestamp: {
        type: Date,
        default: Date.now,
        index: true // Time-series query
    }
}, {
    expires: '7d' // Keep raw pings for 7 days
});

module.exports = mongoose.model('LocationPing', locationPingSchema);
