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
    // Required: House/Flat, Type implies some structure
    if (addressData.flat_no || addressData.houseNumber) breakdown.structure += 10;
    // Legacy model uses 'type' in Residence, Address has flat_no
    // We'll check for generic existence of fields
    if (addressData.floor_no) breakdown.structure += 5;
    if (addressData.city && addressData.postal_code) breakdown.structure += 5;
    if (addressData.official_address) breakdown.structure += 5; // Basic address line
    // If apartment details exist (legacy structure mixes this, checking generic keys)
    if (addressData.apartmentName || (addressData.apartmentDetails && addressData.apartmentDetails.name)) breakdown.structure += 5;

    // 2. Spatial (Max 30)
    // Road Point
    if (addressData.road_point && addressData.road_point.coordinates) {
        breakdown.spatial += 10;
    }
    // Polyline
    // Check for polyline_smoothed or raw
    if (
        (addressData.polyline_smoothed && addressData.polyline_smoothed.length) ||
        (addressData.polyline_raw && addressData.polyline_raw.length)
    ) {
        breakdown.spatial += 20;
    }

    // 3. Navigation (Max 20)
    if (addressData.entranceType) breakdown.navigation += 5;
    if (addressData.landmark) breakdown.navigation += 10;
    if (addressData.instructions) breakdown.navigation += 5;

    // 4. Visual (Max 10)
    // Legacy uses door_photo, new spec uses gate_image
    if (addressData.door_photo || (addressData.gate_image && addressData.gate_image.url)) {
        breakdown.visual += 10;
    }

    // 5. Verification (Max 10)
    // Check masking fields presence as proxy for verified user
    if (addressData.owner_phone_masked || addressData.is_phone_verified) breakdown.verification += 10;

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
