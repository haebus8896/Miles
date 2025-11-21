const dayjs = require('dayjs');
const DeliverySession = require('../models/DeliverySession');
const Address = require('../models/Address');

exports.createSession = async (req, res) => {
  const { address_code, delivery_partner_id, mode = 'SMART_NAV' } = req.body;
  if (!address_code || !delivery_partner_id) {
    return res.status(400).json({ error: 'address_code and delivery_partner_id are required' });
  }
  const address = await Address.findOne({ code: address_code });
  if (!address) {
    return res.status(404).json({ error: 'Address not found for provided code' });
  }

  const session = await DeliverySession.create({
    address: address._id,
    delivery_partner_id,
    mode,
    a_b_bucket: mode === 'SMART_NAV' ? 'B' : 'A',
    metrics: {}
  });

  res.status(201).json({ sessionId: session._id });
};

exports.completeSession = async (req, res) => {
  const { sessionId } = req.params;
  const { metrics = {}, notes } = req.body;
  const session = await DeliverySession.findById(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.completed_at = new Date();
  session.metrics = {
    duration_seconds: metrics.duration_seconds ?? session.metrics.duration_seconds,
    customer_calls: metrics.customer_calls ?? session.metrics.customer_calls,
    wrong_lane_attempts: metrics.wrong_lane_attempts ?? session.metrics.wrong_lane_attempts,
    distance_meters: metrics.distance_meters ?? session.metrics.distance_meters
  };
  session.notes = notes ?? session.notes;
  await session.save();

  res.json({ session });
};

exports.summary = async (req, res) => {
  const days = Number(req.query.days || 7);
  const since = dayjs().subtract(days, 'day').toDate();

  const sessions = await DeliverySession.find({ createdAt: { $gte: since } });

  const summary = sessions.reduce(
    (acc, session) => {
      const bucket = session.mode;
      acc[bucket].count += 1;
      acc[bucket].duration += session.metrics.duration_seconds || 0;
      acc[bucket].calls += session.metrics.customer_calls || 0;
      acc[bucket].wrongWays += session.metrics.wrong_lane_attempts || 0;
      return acc;
    },
    {
      SMART_NAV: { count: 0, duration: 0, calls: 0, wrongWays: 0 },
      GOOGLE_ONLY: { count: 0, duration: 0, calls: 0, wrongWays: 0 }
    }
  );

  const normalize = (data) => ({
    deliveries: data.count,
    avg_duration_seconds: data.count ? Math.round(data.duration / data.count) : 0,
    avg_calls: data.count ? +(data.calls / data.count).toFixed(2) : 0,
    avg_wrong_lane_attempts: data.count ? +(data.wrongWays / data.count).toFixed(2) : 0
  });

  res.json({
    window_days: days,
    SMART_NAV: normalize(summary.SMART_NAV),
    GOOGLE_ONLY: normalize(summary.GOOGLE_ONLY)
  });
};

