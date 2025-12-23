/**
 * overlapUtils - placeholder for future Turf.js route overlap logic.
 * For MVP this file can contain helper functions using turf for route overlaps.
 */

const turf = require('@turf/turf');

exports.segmentOverlapLength = (poly1, poly2) => {
  // poly1, poly2: arrays of [lng, lat] pairs or GeoJSON lines
  // returns length in meters of overlap (stub)
  try {
    const line1 = turf.lineString(poly1);
    const line2 = turf.lineString(poly2);
    // compute intersection (approx)
    const intersect = turf.lineIntersect(line1, line2);
    return intersect.features.length;
  } catch (e) {
    return 0;
  }
};
