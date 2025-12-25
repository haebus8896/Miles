const { DeliverySession, LocationPing } = require('../models/Tracking');
const { v4: uuidv4 } = require('uuid');

exports.startSession = async (req, res) => {
    const { rider_id } = req.body;
    const session = await DeliverySession.create({
        session_id: uuidv4(),
        rider_id
    });
    res.status(201).json({ success: true, data: session });
};

exports.pingLocation = async (req, res) => {
    const { session_id, lat, lng, speed } = req.body;
    const timestamp = new Date();

    await LocationPing.create({ session_id, lat, lng, speed, timestamp });
    await DeliverySession.updateOne(
        { session_id },
        { $set: { current_location: { lat, lng, speed, timestamp } } }
    );

    res.send('OK');
};
