const turf = require('@turf/turf');

const toLatLng = (point) => ({ lat: Number(point.lat), lng: Number(point.lng) });

const ensureAnchors = (points, start, end) => {
  const cleaned = points
    .map(toLatLng)
    .filter((p, idx, arr) => idx === 0 || p.lat !== arr[idx - 1].lat || p.lng !== arr[idx - 1].lng);

  if (!cleaned.length) {
    cleaned.push(start, end);
  } else {
    cleaned[0] = start;
    cleaned[cleaned.length - 1] = end;
  }
  return cleaned;
};

const chaikinSmooth = (points, iterations = 2) => {
  if (!points || points.length < 3) return points;
  let current = points.map(toLatLng);
  for (let i = 0; i < iterations; i += 1) {
    const next = [current[0]];
    for (let j = 0; j < current.length - 1; j += 1) {
      const p0 = current[j];
      const p1 = current[j + 1];
      next.push({
        lat: 0.75 * p0.lat + 0.25 * p1.lat,
        lng: 0.75 * p0.lng + 0.25 * p1.lng
      });
      next.push({
        lat: 0.25 * p0.lat + 0.75 * p1.lat,
        lng: 0.25 * p0.lng + 0.75 * p1.lng
      });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
};

const computeLengthMeters = (points) => {
  if (!points || points.length < 2) return 0;
  const line = turf.lineString(points.map((p) => [p.lng, p.lat]));
  return turf.length(line, { units: 'meters' });
};

const buildRouteArtifacts = ({ rawPoints, roadPoint, destinationPoint }) => {
  const anchoredRaw = ensureAnchors(rawPoints, roadPoint, destinationPoint);
  const smoothed = chaikinSmooth(anchoredRaw, 2);
  const snapped = ensureAnchors(smoothed, roadPoint, destinationPoint);
  return {
    raw: anchoredRaw,
    smoothed,
    snapped,
    lengthMeters: Math.round(computeLengthMeters(snapped))
  };
};

module.exports = {
  buildRouteArtifacts,
  chaikinSmooth,
  computeLengthMeters
};

