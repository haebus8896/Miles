const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const Address = require('../models/Address');
const Residence = require('../models/Residence');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI is not defined in .env');
    process.exit(1);
}

const migrate = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const addresses = await Address.find({});
        console.log(`Found ${addresses.length} addresses to migrate.`);

        let migratedCount = 0;
        let skippedCount = 0;

        for (const addr of addresses) {
            // Check if already exists by code
            const existing = await Residence.findOne({ smartAddressCode: addr.code });
            if (existing) {
                console.log(`Skipping ${addr.code} - already exists.`);
                skippedCount++;
                continue;
            }

            // Transform Address to Residence
            // Assuming old addresses are independent houses (villas)
            const newResidence = new Residence({
                type: 'villa',
                address: {
                    houseNumber: addr.official_address.split(',')[0] || 'N/A', // Simple heuristic
                    area: addr.locality || addr.official_address,
                    landmark: addr.landmark,
                    pincode: addr.postal_code || '000000',
                    city: addr.city || 'Delhi',
                    state: 'Delhi', // Defaulting
                    tags: addr.tags,
                    instructionsText: addr.instructions,
                    route_length_meters: addr.route_length_meters,
                    source: addr.source,
                    road_point: addr.road_point,
                    destination_point: addr.destination_point,
                    polyline_raw: addr.polyline_raw,
                    polyline_smoothed: addr.polyline_smoothed,
                    polyline_snapped: addr.polyline_snapped,
                    images: addr.door_photo ? [addr.door_photo] : []
                },
                smartAddressCode: addr.code,
                users: [] // No user data to migrate directly in this schema
            });

            await newResidence.save();
            console.log(`Migrated ${addr.code}`);
            migratedCount++;
        }

        console.log(`Migration complete. Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

migrate();
