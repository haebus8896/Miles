const DeliverySession = require('../models/DeliverySession');
const LocationPing = require('../models/LocationPing');
const { nanoid } = require('nanoid');

exports.startSession = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context missing' });

    const { rider_id, metadata, session_id } = req.body;

    const session = await DeliverySession.create({
        tenant_id: req.tenant._id,
        session_id: session_id || nanoid(10),
        rider_id,
        metadata
    });

    res.status(201).json({ success: true, data: session });
};

exports.pingLocation = async (req, res) => {
    // High-volume endpoint
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context missing' });

    const { session_id, lat, lng, speed, bearing, accuracy, battery_level } = req.body;
    const timestamp = new Date();

    // 1. Store History
    // Fire & Forget could be used here for speed, but await for safety in MVP
    await LocationPing.create({
        tenant_id: req.tenant._id,
        session_id,
        lat,
        lng,
        speed,
        bearing,
        accuracy,
        battery_level,
        timestamp
    });

    // 2. Update Session Live State
    await DeliverySession.updateOne(
        { tenant_id: req.tenant._id, session_id },
        {
            $set: {
                current_location: { lat, lng, speed, bearing, timestamp }
            }
        }
    );

    res.status(200).send('OK');
};

exports.getSession = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context missing' });

    const session = await DeliverySession.findOne({
        tenant_id: req.tenant._id,
        session_id: req.params.session_id
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true, data: session });
};
