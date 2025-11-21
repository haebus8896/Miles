const axios = require('axios');
const Address = require('../models/Address');

const GOOGLE_ROADS_URL = 'https://roads.googleapis.com/v1/nearestRoads';

const toPoint = (lat, lng) => ({
  type: 'Point',
  coordinates: [lng, lat]
});

const buildParams = (params) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

async function findNearestRoad({ lat, lng }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { lat, lng, fallback: true };
  }

  const url = `${GOOGLE_ROADS_URL}?${buildParams({
    points: `${lat},${lng}`,
    key: apiKey
  })}`;

  const { data } = await axios.get(url);
  const snapped = data?.snappedPoints?.[0];
  if (!snapped) {
    return { lat, lng, fallback: true };
  }

  return {
    lat: snapped.location.latitude,
    lng: snapped.location.longitude,
    placeId: snapped.placeId,
    originalIndex: snapped.originalIndex
  };
}

async function detectDuplicateAddresses({ lat, lng, radiusMeters = 50 }) {
  return Address.find({
    destination_point: {
      $nearSphere: {
        $geometry: toPoint(lat, lng),
        $maxDistance: radiusMeters
      }
    }
  }).limit(5);
}

function haversineDistanceMeters(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371e3;
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lng - a.lng);

  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ),
      Math.sqrt(1 - (sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ))
    );

  return R * c;
}

module.exports = {
  findNearestRoad,
  detectDuplicateAddresses,
  haversineDistanceMeters,
  toPoint
};

