const mongoose = require('mongoose');

const landmarkSchema = new mongoose.Schema({
    tenant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    // Descriptive name (e.g., "Learned Node near Main St")
    name: {
        type: String,
        default: 'Unnamed Landmark'
    },
    // The point location of this landmark
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    // Confidence Score (0-100+)
    confidence_score: {
        type: Number,
        default: 1
    },
    // List of Address or Polyline IDs that contributed to this landmark
    associated_routes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Polyline'
    }],

    // Metadata
    is_system_generated: {
        type: Boolean,
        default: true
    },
    last_updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Geospatial Index
landmarkSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Landmark', landmarkSchema);
