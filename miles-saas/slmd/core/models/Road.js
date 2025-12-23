const mongoose = require('mongoose');

const roadSchema = new mongoose.Schema({
    tenant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    // Unique external ID if from OSM/Mapbox, else auto-generated
    external_id: String,

    name: String,

    // The segment geometry
    geometry: {
        type: {
            type: String,
            enum: ['LineString'],
            default: 'LineString'
        },
        coordinates: {
            type: [[Number]],
            required: true
        }
    },

    center: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: [Number]
    },

    properties: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },

    is_ghost: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

roadSchema.index({ geometry: '2dsphere' });
roadSchema.index({ center: '2dsphere' });

module.exports = mongoose.model('Road', roadSchema);
