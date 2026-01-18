export function chaikinSmooth(points, iterations = 2) {
  if (!points || points.length < 3) return points;
  let pts = points.map((p) => ({ ...p }));
  for (let it = 0; it < iterations; it += 1) {
    const next = [];
    next.push(pts[0]);
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const Q = { lat: 0.75 * p0.lat + 0.25 * p1.lat, lng: 0.75 * p0.lng + 0.25 * p1.lng };
      const R = { lat: 0.25 * p0.lat + 0.75 * p1.lat, lng: 0.25 * p0.lng + 0.75 * p1.lng };
      next.push(Q);
      next.push(R);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

export function lastPoint(points) {
  if (!points || points.length === 0) return null;
  return points[points.length - 1];
}

const toRad = (value) => (value * Math.PI) / 180;

export function pathDistanceMeters(points = []) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
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
    total += R * c;
  }
  return total;
}


export function formatDistance(meters = 0) {
  if (!meters) return '0 m';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  if (meters >= 100) {
    return `${Math.round(meters)} m`;
  }
  return `${meters.toFixed(1)} m`;
}

export function computeHeading(p1, p2) {
  if (!p1 || !p2) return 0;

  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const dLng = toRad(p2.lng - p1.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// --- Precise Snapping Utils ---

function latLngToMeters(lat, lng, refLat) {
  const R = 6378137; // Earth radius in meters
  const x = (lng * Math.PI / 180) * R * Math.cos(refLat * Math.PI / 180);
  const y = (lat * Math.PI / 180) * R;
  return { x, y };
}

function metersToLatLng(x, y, refLat) {
  const R = 6378137;
  const lat = (y / R) * (180 / Math.PI);
  const lng = (x / (R * Math.cos(refLat * Math.PI / 180))) * (180 / Math.PI);
  return { lat, lng };
}

export function snapPointToPolyline(clickLatLng, polyline) {
  const clickLat = typeof clickLatLng.lat === 'function' ? clickLatLng.lat() : clickLatLng.lat;
  const clickLng = typeof clickLatLng.lng === 'function' ? clickLatLng.lng() : clickLatLng.lng;

  const refLat = clickLat;
  const P = latLngToMeters(clickLat, clickLng, refLat);

  let closestPoint = null;
  let minDistSq = Infinity;

  // Polyline is array of {lat, lng} objects
  for (let i = 0; i < polyline.length - 1; i++) {
    const A_ll = polyline[i];
    const B_ll = polyline[i + 1];

    const A = latLngToMeters(A_ll.lat, A_ll.lng, refLat);
    const B = latLngToMeters(B_ll.lat, B_ll.lng, refLat);

    const ABx = B.x - A.x;
    const ABy = B.y - A.y;

    const APx = P.x - A.x;
    const APy = P.y - A.y;

    const abLenSq = ABx * ABx + ABy * ABy;
    if (abLenSq === 0) continue;

    let t = (APx * ABx + APy * ABy) / abLenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = A.x + t * ABx;
    const projY = A.y + t * ABy;

    const dx = P.x - projX;
    const dy = P.y - projY;
    const distSq = dx * dx + dy * dy;

    if (distSq < minDistSq) {
      minDistSq = distSq;
      closestPoint = metersToLatLng(projX, projY, refLat);
    }
  }

  return closestPoint; // { lat, lng }
}
