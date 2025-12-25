const RiderProfile = require('../models/RiderProfile');
const { nanoid } = require('nanoid');

exports.createRider = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context missing' });

    const { name, phone, vehicle, rider_code } = req.body;

    const rider = await RiderProfile.create({
        tenant_id: req.tenant._id,
        rider_code: rider_code || `RID-${nanoid(6).toUpperCase()}`,
        name,
        phone,
        vehicle
    });

    res.status(201).json({ success: true, data: rider });
};

exports.getRiders = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context missing' });

    const riders = await RiderProfile.find({ tenant_id: req.tenant._id }).limit(50);
    res.json({ success: true, count: riders.length, data: riders });
};

exports.updateStatus = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context missing' });

    const { status } = req.body;

    const rider = await RiderProfile.findOneAndUpdate(
        { tenant_id: req.tenant._id, rider_code: req.params.code },
        { current_status: status },
        { new: true }
    );

    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    res.json({ success: true, data: rider });
};
