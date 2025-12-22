const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Address = require('../models/Address');
const Residence = require('../models/Residence');
const AddressRecord = require('../models/AddressRecord');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI is not defined in .env');
    process.exit(1);
}

const debugAddress = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const code = 'SLMD-GX4KT5'; // The code user mentioned
        console.log(`Searching for ${code}...`);

        const addr = await Address.findOne({ code: code });
        if (addr) {
            console.log('Found in Address collection:', JSON.stringify(addr, null, 2));
        } else {
            console.log('Not found in Address collection');
        }

        const res = await Residence.findOne({ smartAddressCode: code });
        if (res) {
            console.log('Found in Residence collection:', JSON.stringify(res, null, 2));
        } else {
            console.log('Not found in Residence collection');
        }

        const rec = await AddressRecord.findOne({ smartAddressCode: code });
        if (rec) {
            console.log('Found in AddressRecord collection:', JSON.stringify(rec, null, 2));
        } else {
            console.log('Not found in AddressRecord collection');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

debugAddress();
