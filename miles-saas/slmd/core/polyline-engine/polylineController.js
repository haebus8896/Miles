const Polyline = require('../models/Polyline');
const Road = require('../models/Road');
const Joi = require('joi');
const turf = require('@turf/turf');

// Validation
const createPolylineSchema = Joi.object({
    name: Joi.string().optional(),
    coordinates: Joi.array().items(Joi.array().items(Joi.number()).length(2)).min(2).required(),
    type: Joi.string().valid('last_mile', 'campus', 'bypass', 'temp').default('last_mile')
});

exports.createPolyline = async (req, res) => {
    const { error, value } = createPolylineSchema.validate(req.body);
    if (error) throw new Error(error.details[0].message);

    if (!req.tenant) return res.status(403).json({ error: 'Tenant context missing' });

    const polyline = await Polyline.create({
        tenant_id: req.tenant._id,
        name: value.name || `Path ${Date.now()}`,
        type: value.type,
        geometry: {
            type: 'LineString',
            coordinates: value.coordinates
        },
        created_by: req.user ? req.user._id : null
    });

    res.status(201).json({ success: true, data: polyline });
};

exports.getPolylines = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context required' });

    const { lat, lng, radius = 500 } = req.query;
    const query = { tenant_id: req.tenant._id };

    if (lat && lng) {
        query.geometry = {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                $maxDistance: parseInt(radius)
            }
        };
    }

    const polylines = await Polyline.find(query).limit(100);
    res.json({ success: true, count: polylines.length, data: polylines });
};

// --- Road / Ghost Road Methods ---

exports.createRoad = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context missing' });

    // Basic creation for "discovered" roads
    const { coordinates, name, is_ghost } = req.body;

    // Calculate center using Turf
    const line = turf.lineString(coordinates);
    const centroid = turf.center(line);

    const road = await Road.create({
        tenant_id: req.tenant._id,
        name,
        is_ghost: !!is_ghost,
        geometry: {
            type: 'LineString',
            coordinates
        },
        center: centroid.geometry
    });

    res.status(201).json({ success: true, data: road });
};

exports.getNearbyRoads = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context required' });
    const { lat, lng, radius = 200 } = req.query;

    if (!lat || !lng) return res.status(400).json({ error: 'lat/lng required' });

    const roads = await Road.find({
        tenant_id: req.tenant._id,
        geometry: {
            $near: {
                $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                $maxDistance: parseInt(radius)
            }
        }
    });

    res.json({ success: true, count: roads.length, data: roads });
};
