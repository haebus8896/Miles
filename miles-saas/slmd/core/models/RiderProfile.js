const mongoose = require('mongoose');

const riderProfileSchema = new mongoose.Schema({
    tenant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },

    // Link to Auth User (optional if riders are separate users)
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    rider_code: { type: String, required: true, unique: true }, // "RID-001"

    name: String,
    phone: String,

    vehicle: {
        type: String,
        enum: ['bike', 'scooter', 'van', 'truck', 'walker'],
        default: 'bike'
    },

    current_status: {
        type: String,
        enum: ['offline', 'idle', 'on_trip', 'break'],
        default: 'offline'
    },

    shift_start: Date,
    shift_end: Date,

    metrics: {
        total_deliveries: { type: Number, default: 0 },
        rating: { type: Number, default: 5.0 }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('RiderProfile', riderProfileSchema);
