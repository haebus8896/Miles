const Address = require('../models/Address');
const { buildAddressCode } = require('../utils/codeGenerator');
const { buildRouteArtifacts } = require('../services/polylineService');
const { maskName, maskPhone } = require('../utils/mask');
const { encrypt } = require('../utils/encryption');
const { findNearestRoad, detectDuplicateAddresses, toPoint } = require('../services/geoService');

const serializeAddress = (doc) => ({
  id: doc._id,
  code: doc.code,
  official_address: doc.official_address,
  landmark: doc.landmark,
  locality: doc.locality,
  city: doc.city,
  postal_code: doc.postal_code,
  floor_no: doc.floor_no,
  flat_no: doc.flat_no,
  instructions: doc.instructions,
  tags: doc.tags,
  route_length_meters: doc.route_length_meters,
  road_point: doc.road_point
    ? { lat: doc.road_point.coordinates[1], lng: doc.road_point.coordinates[0] }
    : null,
  destination_point: doc.destination_point
    ? { lat: doc.destination_point.coordinates[1], lng: doc.destination_point.coordinates[0] }
    : null,
  polyline_smoothed: doc.polyline_smoothed,
  owner_name_masked: doc.owner_name_masked,
  owner_phone_masked: doc.owner_phone_masked,
  door_photo: doc.door_photo,
  createdAt: doc.createdAt
});

const normalizeLatLng = (point = {}) => {
  if (point.lat === undefined || point.lng === undefined) {
    throw new Error('lat/lng required');
  }
  return {
    lat: Number(point.lat),
    lng: Number(point.lng)
  };
};

exports.createAddress = async (req, res) => {
  const {
    official_address,
    landmark = '',
    locality = '',
    city = '',
    postal_code = '',
    floor_no = 0,
    flat_no = '',
    instructions = '',
    tags = [],
    door_photo = '',
    polyline = [],
    road_point,
    destination_point,
    owner_full_name = '',
    owner_phone = ''
  } = req.body;

  const lastPolylinePoint = polyline && polyline.length ? polyline[polyline.length - 1] : null;
  const destinationPoint = destination_point
    ? normalizeLatLng(destination_point)
    : lastPolylinePoint
    ? normalizeLatLng(lastPolylinePoint)
    : null;
  if (!destinationPoint) {
    throw new Error('destination_point or polyline end point is required');
  }

  const roadPointCandidate = road_point
    ? normalizeLatLng(road_point)
    : await findNearestRoad(destinationPoint);
  const roadPoint = normalizeLatLng(roadPointCandidate);

  const route = buildRouteArtifacts({
    rawPoints: polyline.length ? polyline : [roadPoint, destinationPoint],
    roadPoint,
    destinationPoint
  });

  const duplicates = await detectDuplicateAddresses({
    lat: destinationPoint.lat,
    lng: destinationPoint.lng,
    radiusMeters: 40
  });

  const doc = await Address.create({
    code: buildAddressCode(),
    official_address,
    landmark,
    locality,
    city,
    postal_code,
    floor_no,
    flat_no,
    instructions,
    tags,
    door_photo,
    route_length_meters: route.lengthMeters,
    road_point: toPoint(roadPoint.lat, roadPoint.lng),
    destination_point: toPoint(destinationPoint.lat, destinationPoint.lng),
    polyline_raw: route.raw,
    polyline_smoothed: route.smoothed,
    polyline_snapped: route.snapped,
    owner_name_masked: owner_full_name ? maskName(owner_full_name) : '',
    owner_phone_masked: owner_phone ? maskPhone(owner_phone) : '',
    owner_name_encrypted: owner_full_name ? encrypt(owner_full_name) : '',
    owner_phone_encrypted: owner_phone ? encrypt(owner_phone) : ''
  });

  res.status(201).json({
    address: serializeAddress(doc),
    duplicates: duplicates.map(serializeAddress)
  });
};

exports.updateAddress = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const doc = await Address.findById(id);
  if (!doc) {
    return res.status(404).json({ error: 'Address not found' });
  }

  const mutableFields = [
    'official_address',
    'landmark',
    'locality',
    'city',
    'postal_code',
    'floor_no',
    'flat_no',
    'instructions',
    'tags',
    'door_photo'
  ];

  mutableFields.forEach((field) => {
    if (updates[field] !== undefined) {
      doc[field] = updates[field];
    }
  });

  await doc.save();
  res.json({ address: serializeAddress(doc) });
};

exports.getAddressByCode = async (req, res) => {
  const { codeOrId } = req.params;
  const query = codeOrId.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: codeOrId }
    : { code: codeOrId.toUpperCase() };
  const doc = await Address.findOne(query);
  if (!doc) {
    return res.status(404).json({ error: 'Address not found' });
  }
  res.json({ address: serializeAddress(doc) });
};

exports.getNearby = async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radius = parseFloat(req.query.radius) || 50;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat/lng required' });
  }

  const docs = await Address.find({
    destination_point: {
      $nearSphere: {
        $geometry: toPoint(lat, lng),
        $maxDistance: radius
      }
    }
  }).limit(50);

  res.json({ results: docs.map(serializeAddress) });
};

exports.checkDuplicate = async (req, res) => {
  const { lat, lng, radius = 40 } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat/lng required' });
  }
  const duplicates = await detectDuplicateAddresses({
    lat: Number(lat),
    lng: Number(lng),
    radiusMeters: Number(radius)
  });
  res.json({ results: duplicates.map(serializeAddress) });
};
