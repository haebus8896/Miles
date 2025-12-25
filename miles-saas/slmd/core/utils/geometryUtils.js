const turf = require('@turf/turf');

/**
 * Calculates overlap percentage between two polylines using buffering.
 * @param {Array} path1 - Array of [lng, lat] coords
 * @param {Array} path2 - Array of [lng, lat] coords
 * @returns {Object} { overlapPercentage, intersectionCenter }
 */
exports.calculatePathOverlap = (path1, path2) => {
    // 1. Convert to LineStrings
    const line1 = turf.lineString(path1);
    const line2 = turf.lineString(path2);

    // 2. Buffer them (e.g., 5 meters wide) to account for GPS jitter
    // Units are kilometers
    const buffer1 = turf.buffer(line1, 0.005, { units: 'kilometers' });
    const buffer2 = turf.buffer(line2, 0.005, { units: 'kilometers' });

    // 3. Calculate Intersection of Buffers
    const intersection = turf.intersect(buffer1, buffer2);

    if (!intersection) {
        return { overlapPercentage: 0, intersectionCenter: null };
    }

    // 4. Calculate Area Ratios
    const area1 = turf.area(buffer1);
    const area2 = turf.area(buffer2);
    const intersectionArea = turf.area(intersection);

    // Overlap relative to the smaller path (to detect if one is a subset of other)
    const minArea = Math.min(area1, area2);
    const overlapPercentage = (intersectionArea / minArea) * 100;

    // 5. Find Center of Intersection (Potential Landmark)
    const intersectionCenter = turf.center(intersection);

    return {
        overlapPercentage, // 0-100
        intersectionCenter: intersectionCenter.geometry
    };
};
