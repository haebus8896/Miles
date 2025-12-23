const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

const fixIndexes = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const collection = mongoose.connection.collection('addressrecords');

        // List existing indexes
        const indexes = await collection.indexes();
        console.log('Current Indexes:', JSON.stringify(indexes, null, 2));

        // Drop old index if exists
        const oldIndexName = 'addressDetails.destination_point_2dsphere';
        if (indexes.find(i => i.name === oldIndexName)) {
            console.log(`Dropping old index: ${oldIndexName}`);
            await collection.dropIndex(oldIndexName);
        }

        // Create new index
        console.log('Creating new index on destination_point...');
        await collection.createIndex({ destination_point: '2dsphere' });
        console.log('Index created successfully.');

        // Verify
        const newIndexes = await collection.indexes();
        console.log('New Indexes:', JSON.stringify(newIndexes, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

fixIndexes();
