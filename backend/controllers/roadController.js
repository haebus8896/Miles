const { findNearestRoad } = require('../services/geoService');

exports.nearest = async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat/lng required' });
  }

  const roadPoint = await findNearestRoad({ lat, lng });
  res.json({ road_point: roadPoint });
};
