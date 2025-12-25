const turf = require('@turf/turf');

/**
 * Calculates Address Quality Score (0-100)
 * 5 Dimensions:
 * 1. Structural (30%) - Form fields
 * 2. Spatial (30%) - Map/Polyline
 * 3. Navigation (20%) - Instructions/Landmarks
 * 4. Visual (10%) - Gate Image
 * 5. Verification (10%) - OTP/Name
 */
exports.calculateAQS = (addressData) => {
    let breakdown = {
        structure: 0,
        spatial: 0,
        navigation: 0,
        visual: 0,
        verification: 0
    };

    // 1. Structural (Max 30)
    // Required: House/Flat, Residence Type
    // Bonus: Floor, Apartment Name
    if (addressData.house_no) breakdown.structure += 10;
    if (addressData.residence_type) breakdown.structure += 5;
    if (addressData.apartment_name) breakdown.structure += 5;
    if (addressData.floor_no) breakdown.structure += 5;
    if (addressData.city && addressData.pincode) breakdown.structure += 5;

    // 2. Spatial (Max 30)
    // Anchor present = 10
    // Polyline present = 20
    if (addressData.road_anchor_point && addressData.road_anchor_point.coordinates && addressData.road_anchor_point.coordinates.length) {
        breakdown.spatial += 10;
    }
    if (addressData.polyline_id) {
        breakdown.spatial += 20;
    }

    // 3. Navigation (Max 20)
    if (addressData.entrance_type) breakdown.navigation += 5;
    if (addressData.nearby_landmark) breakdown.navigation += 10;
    if (addressData.metadata && addressData.metadata.delivery_instructions) breakdown.navigation += 5;

    // 4. Visual (Max 10)
    if (addressData.gate_image && addressData.gate_image.url) {
        breakdown.visual += 10;
    }

    // 5. Verification (Max 10)
    // Assuming if we are saving, phone is verified (often handled by auth/OTP flow beforehand)
    // For now, check if user name is present or specific verify flag
    if (addressData.is_phone_verified) breakdown.verification += 10;
    else if (addressData.created_by) breakdown.verification += 5; // Partial trust

    // Sanity Caps
    if (breakdown.structure > 30) breakdown.structure = 30;
    if (breakdown.spatial > 30) breakdown.spatial = 30;

    const total =
        breakdown.structure +
        breakdown.spatial +
        breakdown.navigation +
        breakdown.visual +
        breakdown.verification;

    let grade = 'POOR';
    if (total >= 80) grade = 'EXCELLENT';
    else if (total >= 60) grade = 'ACCEPTABLE';

    return {
        score: total,
        grade,
        benchmark: 60,
        breakdown,
        calculated_at: new Date()
    };
};
