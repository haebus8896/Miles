const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const addressSchema = new mongoose.Schema({
    tenant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    address_code: {
        type: String,
        required: true,
        index: true,
        default: () => `SLMD-${nanoid(6).toUpperCase()}`
    },
    // GeoJSON Point for the "Door" or "Building" actual location
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [lng, lat]
            required: true
        }
    },
    // The snapped point on the road grid
    road_anchor_point: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number]
        }
    },
    // Link to the Polyline object for the last-mile path
    polyline_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Polyline'
    },
    // Detailed Address Fields
    house_no: String,
    floor_no: String,
    apartment_name: String,
    residence_type: String, // apartment, house, office
    entrance_type: String, // main_gate, side_entry
    nearby_landmark: String,

    gate_image: {
        url: String,
        source: {
            type: String,
            enum: ['upload', 'streetview']
        },
        captured_at: Date
    },

    is_phone_verified: { type: Boolean, default: false },

    quality_score: {
        score: { type: Number, default: 0 },
        grade: { type: String, enum: ['EXCELLENT', 'ACCEPTABLE', 'POOR'], default: 'POOR' },
        benchmark: { type: Number, default: 60 },
        breakdown: {
            structure: Number,
            spatial: Number,
            navigation: Number,
            visual: Number,
            verification: Number
        },
        calculated_at: Date
    },

    metadata: {
        type: Map,
        of: String
    },

    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Compound index to ensure address codes are unique PER TENANT
addressSchema.index({ tenant_id: 1, address_code: 1 }, { unique: true });

// Geospatial index for radius search
addressSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Address', addressSchema);
