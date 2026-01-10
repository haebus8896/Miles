const AddressRecord = require('../models/AddressRecord');
const HouseholdProfile = require('../models/HouseholdProfile');
const UserProfile = require('../models/UserProfile');
const axios = require('axios');
const { buildAddressCode } = require('../utils/codeGenerator');
const { buildRouteArtifacts } = require('../services/polylineService');
const { findNearestRoad, toPoint } = require('../services/geoService');
const { encrypt } = require('../utils/encryption');
const { maskName, maskPhone } = require('../utils/mask');

const normalizeLatLng = (point = {}) => {
    if (point.lat === undefined || point.lng === undefined) {
        throw new Error('lat/lng required');
    }
    return {
        lat: Number(point.lat),
        lng: Number(point.lng)
    };
};

// Mock Places API Data
const MOCK_PLACES = [
    { name: 'Prestige Golfshire', area: 'Nandi Hills', city: 'Bengaluru' },
    { name: 'Prestige Shantiniketan', area: 'Whitefield', city: 'Bengaluru' },
    { name: 'DLF Camellias', area: 'Golf Course Road', city: 'Gurugram' },
    { name: 'Lodha World Towers', area: 'Lower Parel', city: 'Mumbai' }
];

exports.checkApartmentName = async (req, res) => {
    const { query } = req.body;
    if (!query || query.length < 3) {
        return res.json({ results: [] });
    }

    // 1. DB Search
    const dbResults = await AddressRecord.find(
        {
            residenceType: 'apartment',
            $text: { $search: query }
        },
        { score: { $meta: 'textScore' } }
    )
        .sort({ score: { $meta: 'textScore' } })
        .limit(5)
        .select('apartmentDetails addressDetails');

    // 2. Mock Places API Search
    const apiResults = MOCK_PLACES.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase())
    ).map(p => ({
        apartmentDetails: { name: p.name },
        addressDetails: { area: p.area, city: p.city, state: 'Karnataka' }, // Mock state
        source: 'places_api'
    }));

    // Merge results (simple concat for now)
    const results = [...dbResults, ...apiResults];

    res.json({ results });
};

exports.getPincodeDetails = async (req, res) => {
    const { pincode } = req.params;

    if (!pincode || pincode.length !== 6) {
        return res.status(400).json({ error: 'Invalid pincode' });
    }

    try {
        const apiKey = process.env.PINCODE_API_KEY;
        const apiUrl = process.env.PINCODE_API_URL;

        // Fallback: If no API key is set, use simple mock logic (prevents crash)
        if (!apiKey || !apiUrl) {
            console.warn('[Mock] PINCODE_API_KEY missing. Using static fallback.');
            if (pincode.startsWith('11')) return res.json({ city: 'New Delhi', state: 'Delhi' });
            if (pincode.startsWith('56')) return res.json({ city: 'Bengaluru', state: 'Karnataka' });
            if (pincode.startsWith('40')) return res.json({ city: 'Mumbai', state: 'Maharashtra' });
            if (pincode.startsWith('60')) return res.json({ city: 'Chennai', state: 'Tamil Nadu' });
            if (pincode.startsWith('70')) return res.json({ city: 'Kolkata', state: 'West Bengal' });
            // Default: Empty, user must type manually
            return res.json({ city: '', state: '' });
        }

        // OGD India API format: filters[pincode]=110001
        const response = await axios.get(apiUrl, {
            params: {
                'api-key': apiKey,
                'format': 'json',
                'filters[pincode]': pincode
            }
        });

        const records = response.data.records;

        if (records && records.length > 0) {
            // Take the first record
            const data = records[0];
            // Map API fields to our schema
            // API returns: district, statename (lowercase keys)
            res.json({
                city: data.district,
                state: data.statename
            });
        } else {
            res.status(404).json({ error: 'Pincode not found' });
        }
    } catch (error) {
        console.error('Pincode API Error:', error.message);
        // Fallback to mock or error
        res.status(500).json({ error: 'Failed to fetch pincode details' });
    }
};

exports.createResidence = async (req, res) => {
    try {
        const {
            type,
            apartmentDetails,
            address, // contains addressDetails fields
            user, // { name, phone, verified }
            polylineData
        } = req.body;

        // 1. Process Polyline
        let routeArtifacts = {};
        let roadPointDb, destinationPointDb, sourceDb;

        if (polylineData && polylineData.polyline && polylineData.polyline.length > 0) {
            const polyline = polylineData.polyline;
            const lastPolylinePoint = polyline[polyline.length - 1];

            const destinationPoint = polylineData.destination_point
                ? normalizeLatLng(polylineData.destination_point)
                : normalizeLatLng(lastPolylinePoint);

            const roadPointCandidate = polylineData.road_point
                ? normalizeLatLng(polylineData.road_point)
                : await findNearestRoad(destinationPoint);

            const roadPoint = normalizeLatLng(roadPointCandidate);

            const route = buildRouteArtifacts({
                rawPoints: polyline,
                roadPoint,
                destinationPoint
            });

            routeArtifacts = {
                route_length_meters: route.lengthMeters,
                polylineRaw: route.raw,
                polylineOptimized: route.smoothed
            };

            roadPointDb = toPoint(roadPoint.lat, roadPoint.lng);
            destinationPointDb = toPoint(destinationPoint.lat, destinationPoint.lng);
            if (polylineData.source) {
                sourceDb = toPoint(polylineData.source.lat, polylineData.source.lng);
            }
        }

        // 2. Create AddressRecord
        const aqs = require('../utils/aqsCalculator').calculateAQS({
            flat_no: address.houseNumber, // Mapping
            houseNumber: address.houseNumber,
            floor_no: apartmentDetails ? apartmentDetails.floorNumber : undefined,
            city: address.city,
            postal_code: address.pincode,
            official_address: `${address.houseNumber} ${address.area}`,
            apartmentDetails,
            road_point: roadPointDb ? { coordinates: roadPointDb.coordinates } : null,
            polyline_smoothed: routeArtifacts.polylineOptimized,
            landmark: address.landmark,
            instructions: address.instructionsText,
            gate_image: { url: address.gateImageUrl }, // Map to expected object
            owner_phone_masked: user.phone // Assumed verified
        });

        const newAddress = new AddressRecord({
            residenceType: type,
            apartmentDetails: type === 'apartment' ? apartmentDetails : undefined,
            addressDetails: {
                ...address,
                gateImageUrl: address.gateImageUrl,
                instructionsAudioUrl: address.instructionsAudioUrl
            },
            ...routeArtifacts,
            road_point: roadPointDb,
            destination_point: destinationPointDb,
            source: sourceDb,
            smartAddressCode: buildAddressCode(),
            quality_score: aqs
        });

        await newAddress.save();

        // 3. Create HouseholdProfile
        const newHousehold = new HouseholdProfile({
            addressId: newAddress._id,
            primaryResident: {
                encryptedName: encrypt(user.name),
                encryptedPhone: encrypt(user.phone),
                verified: true
            },
            maskedDisplayData: {
                primary: {
                    maskedName: maskName(user.name),
                    maskedPhone: maskPhone(user.phone)
                },
                members: []
            }
        });

        await newHousehold.save();

        // 4. Link Household to Address
        newAddress.householdProfileId = newHousehold._id;
        await newAddress.save();

        // 5. Create/Update UserProfile
        // Check if user exists by phone (need deterministic encryption or search by hash if we had one)
        // For this demo, we'll just create a new one or find by encrypted phone if encryption was deterministic (it's not here usually)
        // We will assume a new user for simplicity or just append to a list if we had a proper auth system.

        // In a real system, we'd look up by a hashed phone index. 
        // Here we will just create a UserProfile for the record.
        const newUser = new UserProfile({
            encryptedName: encrypt(user.name),
            encryptedPhone: encrypt(user.phone),
            linkedHouseholdProfiles: [newHousehold._id],
            verificationStatus: 'verified'
        });
        await newUser.save();

        res.status(201).json({
            success: true,
            addressCode: newAddress.smartAddressCode,
            household: newHousehold,
            addressId: newAddress._id,
            quality_score: newAddress.quality_score
        });

    } catch (error) {
        console.error('Create Residence Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.addProfile = async (req, res) => {
    const { id } = req.params; // This is addressId or smartAddressCode
    const { name, phone, relationship } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone required' });
    }

    try {
        // Find Address first to get householdId
        const address = await AddressRecord.findOne({
            $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { smartAddressCode: id }]
        });

        if (!address) {
            return res.status(404).json({ error: 'Address not found' });
        }

        const household = await HouseholdProfile.findById(address.householdProfileId);
        if (!household) {
            return res.status(404).json({ error: 'Household profile not found' });
        }

        // Add member
        household.members.push({
            encryptedName: encrypt(name),
            encryptedPhone: encrypt(phone),
            relationship,
            verified: true,
            verifiedAt: new Date()
        });

        // Update masked data
        household.maskedDisplayData.members.push({
            maskedName: maskName(name),
            maskedPhone: maskPhone(phone),
            relationship
        });

        await household.save();

        res.json({ success: true, household });
    } catch (error) {
        console.error('Add Profile Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// --- Phase 3: Search & Edit ---

exports.getResidenceByCode = async (req, res) => {
    const { code } = req.params;
    try {
        const address = await AddressRecord.findOne({ smartAddressCode: code });
        if (!address) {
            return res.status(404).json({ error: 'Address not found' });
        }

        const household = await HouseholdProfile.findById(address.householdProfileId);

        res.json({
            address,
            household // Contains masked data
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.sendEditOtp = async (req, res) => {
    const { id } = req.params; // Address ID
    try {
        const address = await AddressRecord.findById(id);
        if (!address) return res.status(404).json({ error: 'Address not found' });

        const household = await HouseholdProfile.findById(address.householdProfileId);
        // In a real app, we would decrypt the phone here to send SMS
        // const phone = decrypt(household.primaryResident.encryptedPhone);

        // For Mock:
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        console.log(`[MOCK OTP] Edit OTP for ${id}: ${otp}`);

        // Store OTP in memory or DB (simplified for demo: just return it)
        // In production, use Redis or a temp field in DB

        res.json({ success: true, message: 'OTP sent', debugOtp: otp });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.verifyEditOtp = async (req, res) => {
    const { id } = req.params;
    const { otp } = req.body;

    // Mock Verification
    if (otp && otp.length === 4) {
        res.json({ success: true, token: 'mock-edit-token' });
    } else {
        res.status(400).json({ error: 'Invalid OTP' });
    }
};

exports.updateResidence = async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    try {
        const address = await AddressRecord.findByIdAndUpdate(id, updateData, { new: true });
        res.json({ success: true, address });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
