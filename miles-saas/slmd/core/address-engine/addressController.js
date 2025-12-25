const Address = require('../models/Address');
const Joi = require('joi');

const { calculateAQS } = require('../utils/aqsCalculator');

// Validation Schemas
const createAddressSchema = Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),

    // Detailed fields
    house_no: Joi.string().required(),
    floor_no: Joi.string().allow(''),
    apartment_name: Joi.string().allow(''),
    residence_type: Joi.string().valid('apartment', 'house', 'office').required(),
    entrance_type: Joi.string().allow(''),
    nearby_landmark: Joi.string().allow(''),
    city: Joi.string().required(),
    pincode: Joi.string().required(),

    gate_image: Joi.object({
        url: Joi.string(),
        source: Joi.string().valid('upload', 'streetview'),
        captured_at: Joi.date()
    }),

    // Associated spatial data for scoring
    polyline_id: Joi.string().allow(''),

    metadata: Joi.object()
});

exports.createAddress = async (req, res) => {
    // 1. Validate Input
    const { error, value } = createAddressSchema.validate(req.body);
    if (error) throw new Error(error.details[0].message);

    // 2. Ensure Tenant Context
    if (!req.tenant) {
        return res.status(403).json({ error: 'Tenant context missing' });
    }

    // 3. Prepare Data for AQS
    // merge user input with potential associated data (like polyline)
    const addressPayload = {
        ...value,
        created_by: req.user ? req.user.name : 'Unknown', // Simplistic
        is_phone_verified: true // Assume verified for now if auth passed
    };

    // 4. Calculate Score
    const aqs = calculateAQS(addressPayload);

    // 5. Create Address
    const address = await Address.create({
        tenant_id: req.tenant._id,
        location: {
            type: 'Point',
            coordinates: [value.longitude, value.latitude]
        },

        // Explicit mapping to schema
        house_no: value.house_no,
        floor_no: value.floor_no,
        apartment_name: value.apartment_name,
        residence_type: value.residence_type,
        entrance_type: value.entrance_type,
        nearby_landmark: value.nearby_landmark,
        city: value.city,
        pincode: value.pincode,

        gate_image: value.gate_image,
        polyline_id: value.polyline_id || null, // If provided linked immediately

        quality_score: aqs, // Store the calculated object

        metadata: value.metadata,
        created_by: req.user ? req.user._id : null
    });

    res.status(201).json({ success: true, data: address });
};

exports.getAddresses = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context required' });

    const { lat, lng, radius = 1000, limit = 50 } = req.query;

    let query = { tenant_id: req.tenant._id };

    // Spatial Query
    if (lat && lng) {
        query.location = {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                $maxDistance: parseInt(radius) // meters
            }
        };
    }

    const addresses = await Address.find(query).limit(parseInt(limit)).sort('-createdAt');

    res.json({ success: true, count: addresses.length, data: addresses });
};

exports.getAddressByCode = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context required' });

    const address = await Address.findOne({
        tenant_id: req.tenant._id,
        address_code: req.params.code
    });

    if (!address) return res.status(404).json({ error: 'Address not found' });

    res.json({ success: true, data: address });
};
