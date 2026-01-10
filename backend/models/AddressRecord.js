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

const AddressRecordSchema = new mongoose.Schema(
    {
        residenceType: {
            type: String,
            enum: ['villa', 'apartment'],
            required: true
        },
        apartmentDetails: {
            name: { type: String, index: 'text' },
            block: { type: String },
            floorNumber: { type: Number },
            totalFloors: { type: Number },
            entranceType: { type: String },
            entranceImageUrl: { type: String }
        },
        addressDetails: {
            houseNumber: { type: String, required: true },
            area: { type: String, required: true, index: true },
            landmark: { type: String },
            pincode: { type: String, required: true, index: true },
            city: { type: String, required: true },
            state: { type: String, required: true },
            tags: { type: [String], default: [] },
            instructionsText: { type: String },
            instructionsAudioUrl: { type: String },
            gateImageUrl: { type: String },
            images: { type: [String], default: [] }
        },
        // Navigation Data
        route_length_meters: { type: Number, default: 0 },
        source: { type: PointSchema },
        road_point: { type: PointSchema },
        destination_point: { type: PointSchema },
        polylineRaw: { type: [PolylinePointSchema], default: [] },
        polylineOptimized: { type: [PolylinePointSchema], default: [] },

        smartAddressCode: { type: String, unique: true, index: true },
        householdProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'HouseholdProfile' },

        quality_score: {
            score: { type: Number, default: 0 },
            grade: { type: String, default: 'POOR' },
            benchmark: { type: Number, default: 60 },
            breakdown: {
                structure: Number,
                spatial: Number,
                navigation: Number,
                visual: Number,
                verification: Number
            },
            calculated_at: Date
        }
    },
    { timestamps: true }
);

AddressRecordSchema.index({ destination_point: '2dsphere' });

module.exports = mongoose.model('AddressRecord', AddressRecordSchema);
