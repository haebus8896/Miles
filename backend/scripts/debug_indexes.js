const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const AddressRecord = require('../models/AddressRecord');

const MONGO_URI = process.env.MONGO_URI;

const debugIndexes = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const collection = mongoose.connection.collection('addressrecords');
        const indexes = await collection.indexes();
        console.log('Indexes on addressrecords:', JSON.stringify(indexes, null, 2));

        // Test Query
        // Use the coordinates from the debug output: 18.580830, 73.769756
        const lat = 18.580830;
        const lng = 73.769756;
        const radius = 1000; // 1km

        console.log(`Testing $nearSphere query at ${lat}, ${lng} with radius ${radius}m...`);

        const results = await AddressRecord.find({
            destination_point: {
                $nearSphere: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    $maxDistance: radius
                }
            }
        });

        console.log(`Found ${results.length} records.`);
        results.forEach(r => console.log(`- ${r.smartAddressCode}: ${r.destination_point.coordinates}`));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

debugIndexes();
