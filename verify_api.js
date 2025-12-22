const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/addresses';

async function testFlow() {
    try {
        console.log('1. Creating Address...');
        const payload = {
            official_address: 'Test House 123',
            city: 'Test City',
            road_point: { lat: 28.6139, lng: 77.2090 },
            destination_point: { lat: 28.6140, lng: 77.2091 },
            polyline: [
                { lat: 28.6139, lng: 77.2090 },
                { lat: 28.61395, lng: 77.20905 },
                { lat: 28.6140, lng: 77.2091 }
            ],
            source: { lat: 28.6100, lng: 77.2000 }
        };

        const createRes = await axios.post(BASE_URL, payload);
        const address = createRes.data.address;
        console.log('Address Created:', address.code);
        console.log('Source Saved:', address.source);

        console.log('2. Retrieving Address by Code...');
        const getRes = await axios.get(`${BASE_URL}/code/${address.code}`);
        const retrieved = getRes.data.address;

        if (retrieved.code === address.code && retrieved.source.lat === payload.source.lat) {
            console.log('Verification SUCCESS: Address retrieved correctly with source.');
        } else {
            console.error('Verification FAILED: Data mismatch.');
        }

    } catch (error) {
        console.error('Verification Error:', error.response ? error.response.data : error.message);
    }
}

testFlow();
