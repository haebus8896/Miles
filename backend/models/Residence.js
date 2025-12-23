const mongoose = require('mongoose');

const PointSchema = new mongoose.Schema(
    {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: {
            type: [Number],
            required: true,
            index: '2dsphere' // [lng, lat]
        }
    },
    { _id: false }
);

const PolylinePointSchema = new mongoose.Schema(
    {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    { _id: false }
);

const ResidenceSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['villa', 'apartment'],
            required: true
        },
        apartmentDetails: {
            name: { type: String, index: 'text' }, // Indexed for autocomplete
            block: { type: String },
            floorNumber: { type: Number },
            totalFloors: { type: Number },
            entranceType: { type: String }, // "Main Gate", "Side Entrance", etc.
            entranceImageUrl: { type: String }
        },
        address: {
            houseNumber: { type: String, required: true },
            area: { type: String, required: true, index: true },
            landmark: { type: String },
            pincode: { type: String, required: true, index: true },
            city: { type: String, required: true },
            state: { type: String, required: true },
            tags: { type: [String], default: [] },
            instructionsText: { type: String },
            instructionsAudioUrl: { type: String },
            // Smart Address / Navigation Data
            route_length_meters: { type: Number, default: 0 },
            source: { type: PointSchema }, // user's starting location
            road_point: { type: PointSchema }, // start of last-mile
            destination_point: { type: PointSchema }, // door location
            polyline_raw: { type: [PolylinePointSchema], default: [] },
            polyline_smoothed: { type: [PolylinePointSchema], default: [] },
            polyline_snapped: { type: [PolylinePointSchema], default: [] },
            images: { type: [String], default: [] } // Optional landmark/apartment images
        },
        imageGallery: [
            {
                uploadedBy: { type: String }, // userId or generic string
                imageUrl: { type: String },
                timestamp: { type: Date, default: Date.now }
            }
        ],
        users: [
            {
                encryptedName: { type: String, required: true },
                encryptedPhone: { type: String, required: true },
                maskedName: { type: String, required: true },
                maskedPhone: { type: String, required: true },
                verified: { type: Boolean, default: false },
                verifiedAt: { type: Date }
            }
        ],
        smartAddressCode: { type: String, unique: true, index: true }
    },
    { timestamps: true }
);

// Indexes
ResidenceSchema.index({ 'address.destination_point': '2dsphere' });
ResidenceSchema.index({ smartAddressCode: 1 }, { unique: true });

module.exports = mongoose.model('Residence', ResidenceSchema);
