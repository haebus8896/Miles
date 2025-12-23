const axios = require('axios');
const Address = require('../models/Address');

const GOOGLE_DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

const toPoint = (lat, lng) => ({
  type: 'Point',
  coordinates: [lng, lat]
});

// --- Utility: Decode Google Polyline ---
function decodePolyline(encoded) {
  if (!encoded) return [];
  const poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return poly;
}

// --- Utility: Compute Offset Point ---
function computeOffset(lat, lng, distMeters, bearingDeg) {
  const R = 6371e3;
  const brng = bearingDeg * (Math.PI / 180);
  const lat1 = lat * (Math.PI / 180);
  const lon1 = lng * (Math.PI / 180);

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distMeters / R) +
    Math.cos(lat1) * Math.sin(distMeters / R) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distMeters / R) * Math.cos(lat1),
    Math.cos(distMeters / R) - Math.sin(lat1) * Math.sin(lat2));

  return {
    lat: lat2 * (180 / Math.PI),
    lng: lon2 * (180 / Math.PI)
  };
}

// --- Utility: Clip Path to Circle ---
function clipPathToCircle(path, center, radiusMeters) {
  if (!path || path.length < 2) return [];

  const clipped = [];
  // Always include the first point if it's inside
  if (haversineDistanceMeters(center, path[0]) <= radiusMeters) {
    clipped.push(path[0]);
  }

  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i];
    const end = path[i + 1];

    const distStart = haversineDistanceMeters(center, start);
    const distEnd = haversineDistanceMeters(center, end);

    // Both inside
    if (distStart <= radiusMeters && distEnd <= radiusMeters) {
      clipped.push(end);
      continue;
    }

    // Exiting circle
    if (distStart <= radiusMeters && distEnd > radiusMeters) {
      const intersect = getCircleIntersection(start, end, center, radiusMeters);
      if (intersect) clipped.push(intersect);
      break; // Stop at the boundary
    }

    // Entering circle (Rare for radial, but possible if path curves back)
    // We treat this as a separate segment usually, but for simplicity we just trim "outsides"
    // If we are strictly clipping "visible area" from center, we usually stop at first exit.
    if (distStart > radiusMeters && distEnd <= radiusMeters) {
      // Entering... tricky. We might skip this segment or start a new one to be perfect.
      // Given we shoot rays FROM center/near-center, the path *mostly* goes out.
      // Breaking at first exit is the safest "connected" behavior.
      break;
    }
  }

  return clipped;
}

function getCircleIntersection(A, B, C, R_meters) {
  // Project to local flat meters relative to C
  const toMeters = (p) => {
    const dLat = (p.lat - C.lat) * 111320;
    const dLng = (p.lng - C.lng) * 111320 * Math.cos(C.lat * Math.PI / 180);
    return { x: dLng, y: dLat };
  };

  const p1 = toMeters(A);
  const p2 = toMeters(B);

  const vx = p2.x - p1.x;
  const vy = p2.y - p1.y;
  const ux = p1.x; // origin is C(0,0)
  const uy = p1.y;

  const a = vx * vx + vy * vy;
  const b = 2 * (ux * vx + uy * vy);
  const c = (ux * ux + uy * uy) - (R_meters * R_meters);

  // solve at^2 + bt + c = 0
  if (Math.abs(a) < 1e-6) return null; // Points coincident

  const det = b * b - 4 * a * c;
  if (det < 0) return null;

  const t1 = (-b - Math.sqrt(det)) / (2 * a);
  const t2 = (-b + Math.sqrt(det)) / (2 * a);

  let t = -1;
  // Prefer t in [0, 1]
  if (t1 >= 0 && t1 <= 1) t = t1;
  else if (t2 >= 0 && t2 <= 1) t = t2;
  // If both valid (secant), we usually want the one "further along" if we are exiting?
  // Actually if we are exiting, we want the first one encountered?
  // Since we check start inside -> end outside, there is exactly one intersection in [0,1].

  if (t < 0) return null;

  return {
    lat: A.lat + (B.lat - A.lat) * t,
    lng: A.lng + (B.lng - A.lng) * t
  };
}


async function findNearbyRoads({ lat, lng, radiusMeters = 100 }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('❌ [geoService] FATAL: GOOGLE_MAPS_API_KEY is missing from process.env!');
    console.error('👉 Make sure you created backend/.env and restarted pm2.');
    return [];
  }

  // Strategy: Dispersed Origins to catch parallel/nearby roads
  // 1 Center + 4 Offsets (30m N, S, E, W)
  const origins = [
    { lat, lng },
    computeOffset(lat, lng, 30, 0),   // North
    computeOffset(lat, lng, 30, 90),  // East
    computeOffset(lat, lng, 30, 180), // South
    computeOffset(lat, lng, 30, 270)  // West
  ];

  // From each origin, shoot 8 rays (45 deg increments)
  // 5 * 8 = 40 requests.
  const requests = [];
  const targetDist = radiusMeters + 30; // 130m to ensure coverage

  origins.forEach(origin => {
    for (let b = 0; b < 360; b += 45) {
      const dest = computeOffset(origin.lat, origin.lng, targetDist, b);
      requests.push({
        origin: `${origin.lat},${origin.lng}`,
        destination: `${dest.lat},${dest.lng}`
      });
    }
  });

  // Batch calls to avoid 429
  // Google limits concurrency often. 10 at a time is safe.
  const results = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const batch = requests.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(req =>
      axios.get(GOOGLE_DIRECTIONS_URL, {
        params: {
          origin: req.origin,
          destination: req.destination,
          travelMode: 'DRIVING',
          key: apiKey
        }
      }).then(res => res.data).catch(e => {
        console.error(`⚠️ [geoService] Google API Error:`, e.response?.data || e.message);
        return null;
      })
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    // Tiny delay to be nice to API
    if (i + BATCH_SIZE < requests.length) await new Promise(r => setTimeout(r, 100));
  }

  // Deduplicate & Process
  const roadPolylines = [];
  const seenHashes = new Set();
  const center = { lat, lng };

  for (const data of results) {
    if (!data || data.status !== 'OK') {
      if (data?.status) console.error(`⚠️ [geoService] Google API Status: ${data.status}`, data.error_message);
      continue;
    }
    if (!data.routes || !data.routes[0]) continue;

    const route = data.routes[0];
    // Use steps for High-Res geometry
    if (!route.legs || !route.legs[0] || !route.legs[0].steps) continue;

    // Stitch steps
    let fullPath = [];
    route.legs[0].steps.forEach(step => {
      if (step.polyline && step.polyline.points) {
        const decoded = decodePolyline(step.polyline.points);
        fullPath.push(...decoded);
      }
    });

    // Filter out duplicate identical paths (roughly) to save processing
    // Hash: start + end + length
    if (fullPath.length < 2) continue;
    const start = fullPath[0];
    const end = fullPath[fullPath.length - 1];
    const hash = `${start.lat.toFixed(5)},${start.lng.toFixed(5)}|${end.lat.toFixed(5)},${end.lng.toFixed(5)}|${fullPath.length}`;

    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);

    // Clip strictly to Original Center
    const clipped = clipPathToCircle(fullPath, center, radiusMeters);

    if (clipped.length >= 2) {
      roadPolylines.push(clipped);
    }
  }

  return roadPolylines;
}

// keeping exports...
async function findNearestRoad({ lat, lng }) {
  return { lat, lng, fallback: true };
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
  const c = 2 * Math.atan2(Math.sqrt(sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ), Math.sqrt(1 - (sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ)));
  return R * c;
}

module.exports = {
  findNearbyRoads,
  findNearestRoad,
  detectDuplicateAddresses,
  haversineDistanceMeters,
  toPoint
};
