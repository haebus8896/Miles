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
