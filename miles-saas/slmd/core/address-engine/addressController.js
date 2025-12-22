const Address = require('../models/Address');
const Joi = require('joi');

// Validation Schemas
const createAddressSchema = Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    full_address: Joi.string().allow(''),
    city: Joi.string(),
    pincode: Joi.string(),
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

    // 3. Create Address
    const address = await Address.create({
        tenant_id: req.tenant._id,
        location: {
            type: 'Point',
            coordinates: [value.longitude, value.latitude]
        },
        full_address: value.full_address,
        city: value.city,
        pincode: value.pincode,
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
