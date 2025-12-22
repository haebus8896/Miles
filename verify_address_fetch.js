require('dotenv').config({ path: '/Users/smritirao/slmd2/backend/.env' });
const mongoose = require('mongoose');
const AddressRecord = require('./backend/models/AddressRecord');
const Address = require('./backend/models/Address');
const controller = require('./backend/controllers/addressController');

// Mock Express Request/Response
const mockReq = (params) => ({ params });
const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

const runVerification = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        // 1. Create a dummy Smart Address (AddressRecord)
        const smartCode = 'TEST-SMART-ADDR-' + Math.floor(Math.random() * 10000);
        const newRecord = await AddressRecord.create({
            residenceType: 'apartment',
            smartAddressCode: smartCode,
            addressDetails: {
                houseNumber: '101',
                area: 'Test Area',
                city: 'Test City',
                pincode: '123456',
                houseNumber: 'Flat 101'
            },
            apartmentDetails: {
                name: 'Test Apartment'
            },
            destination_point: { coordinates: [77.5, 12.9], type: 'Point' }, // lng, lat
            road_point: { coordinates: [77.51, 12.91], type: 'Point' },
            polylineOptimized: [{ lat: 12.9, lng: 77.5 }, { lat: 12.91, lng: 77.51 }]
        });

        console.log(`Created test AddressRecord with code: ${smartCode}`);

        // 2. Call the controller method
        const req = mockReq({ codeOrId: smartCode });
        const res = mockRes();

        await controller.getAddressByCode(req, res);

        // 3. Verify results
        if (res.data && res.data.address) {
            const addr = res.data.address;
            console.log('SUCCESS: Controller returned address:', addr.code);

            if (addr.code === smartCode && addr.type === 'apartment') {
                console.log('✅ Verification Passed: Correctly fetched and serialized AddressRecord.');
            } else {
                console.error('❌ Verification Failed: Data mismatch', addr);
            }
        } else {
            console.error('❌ Verification Failed: No data returned', res.statusCode);
        }

        // Cleanup
        await AddressRecord.deleteOne({ _id: newRecord._id });
        console.log('Cleanup complete.');

    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        await mongoose.disconnect();
    }
};

runVerification();
