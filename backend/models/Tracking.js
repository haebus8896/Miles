const mongoose = require('mongoose');

const DeliverySessionSchema = new mongoose.Schema({
    session_id: { type: String, required: true, unique: true },
    rider_id: String,
    status: { type: String, default: 'active' },
    current_location: {
        lat: Number,
        lng: Number,
        speed: Number,
        timestamp: Date
    },
    start_time: { type: Date, default: Date.now }
}, { timestamps: true });

const LocationPingSchema = new mongoose.Schema({
    session_id: { type: String, required: true, index: true },
    lat: Number,
    lng: Number,
    speed: Number,
    timestamp: { type: Date, default: Date.now, index: true }
}, { expires: '7d' });

module.exports = {
    DeliverySession: mongoose.models.DeliverySession || mongoose.model('DeliverySession', DeliverySessionSchema),
    LocationPing: mongoose.models.LocationPing || mongoose.model('LocationPing', LocationPingSchema)
};
