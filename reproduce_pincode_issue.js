const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/residence/pincode';
const PINCODE = '560001'; // Bangalore pincode

async function testPincode() {
    try {
        console.log(`Testing Pincode API for ${PINCODE}...`);
        const response = await axios.get(`${BASE_URL}/${PINCODE}`);
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testPincode();
