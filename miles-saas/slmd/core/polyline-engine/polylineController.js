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

    // --- Smart Landmark Refinement (Async) ---
    // Background task to check for overlaps and learn landmarks
    (async () => {
        try {
            // 1. Find nearby polylines (within 50m) to compare against
            // Limit to last 50 to avoid performance hit
            const nearbyPolylines = await Polyline.find({
                tenant_id: req.tenant._id,
                _id: { $ne: polyline._id }, // Exclude self
                geometry: {
                    $near: {
                        $geometry: { type: 'Point', coordinates: value.coordinates[0] }, // Start point neighborhood
                        $maxDistance: 50 // meters
                    }
                }
            }).limit(50);

            for (const neighbor of nearbyPolylines) {
                const { overlapPercentage, intersectionCenter } = calculatePathOverlap(value.coordinates, neighbor.geometry.coordinates);

                // If paths share > 60% geometry, we have a "Common Path"
                if (overlapPercentage > 60 && intersectionCenter) {
                    console.log(`[SmartRefinement] High overlap detected (${overlapPercentage.toFixed(1)}%) between ${polyline._id} and ${neighbor._id}`);

                    // Create or Update Landmark at the intersection (Confluence)
                    // Check if a landmark already exists near this intersection
                    let landmark = await Landmark.findOne({
                        tenant_id: req.tenant._id,
                        location: {
                            $near: {
                                $geometry: intersectionCenter,
                                $maxDistance: 20 // 20m radius for grouping
                            }
                        }
                    });

                    if (landmark) {
                        // Strengthen existing landmark
                        landmark.confidence_score += 1;
                        landmark.last_updated_at = Date.now();
                        if (!landmark.associated_routes.includes(polyline._id)) {
                            landmark.associated_routes.push(polyline._id);
                        }
                        await landmark.save();
                        console.log(`[SmartRefinement] Strengthened Landmark: ${landmark.name}`);
                    } else {
                        // Create new "Learned" Landmark
                        const newLandmark = await Landmark.create({
                            tenant_id: req.tenant._id,
                            name: `Learned Node ${Date.now().toString().slice(-4)}`,
                            location: intersectionCenter,
                            confidence_score: 1,
                            associated_routes: [polyline._id, neighbor._id],
                            is_system_generated: true
                        });
                        console.log(`[SmartRefinement] Discovered New Landmark: ${newLandmark.name}`);
                    }
                }
            }
        } catch (err) {
            console.error('[SmartRefinement] Error calculating overlaps:', err);
        }
    })();

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
