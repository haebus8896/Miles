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

const AddressSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true },
    official_address: { type: String, required: true },
    landmark: { type: String, default: '' },
    locality: { type: String, default: '' },
    city: { type: String, default: '' },
    postal_code: { type: String, default: '' },
    floor_no: { type: Number, default: 0 },
    flat_no: { type: String, default: '' },
    instructions: { type: String, default: '' },
    tags: { type: [String], default: [] },
    door_photo: { type: String, default: '' }, // stores a base64 or remote URL
    route_length_meters: { type: Number, default: 0 },
    source: { type: PointSchema, required: false }, // user's starting location (optional)
    road_point: { type: PointSchema, required: true }, // start of last-mile (labelled road)
    destination_point: { type: PointSchema, required: true }, // destination (door)
    polyline_raw: { type: [PolylinePointSchema], default: [] }, // [{lat,lng}, ...]
    polyline_smoothed: { type: [PolylinePointSchema], default: [] },
    polyline_snapped: { type: [PolylinePointSchema], default: [] },
    owner_phone_masked: { type: String, default: '' },
    owner_phone_encrypted: { type: String, default: '' },
    owner_name_masked: { type: String, default: '' },
    owner_name_encrypted: { type: String, default: '' }
  },
  { timestamps: true }
);

AddressSchema.index({ destination_point: '2dsphere' });
AddressSchema.index({ 'polyline_raw.lat': 1, 'polyline_raw.lng': 1 });

module.exports = mongoose.model('Address', AddressSchema);
