const mongoose = require('mongoose');

const polylineSchema = new mongoose.Schema({
    tenant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    name: String,
    type: {
        type: String,
        enum: ['last_mile', 'campus', 'bypass', 'temp'],
        default: 'last_mile'
    },
    // The actual line geometry
    geometry: {
        type: {
            type: String,
            enum: ['LineString'],
            default: 'LineString'
        },
        coordinates: {
            type: [[Number]], // [[lng, lat], [lng, lat]]
            required: true
        }
    },
    distance_meters: Number,
    duration_seconds: Number,

    // Connects to a Road (Anchor logic)
    road_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Road'
    },

    status: {
        type: String,
        enum: ['active', 'blocked', 'review'],
        default: 'active'
    },

    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

polylineSchema.index({ geometry: '2dsphere' });

module.exports = mongoose.model('Polyline', polylineSchema);
