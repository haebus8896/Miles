const axios = require('./backend/node_modules/axios');

async function testRoads() {
    try {
        const lat = 28.6139;
        const lng = 77.2090; // Connaught Place
        const url = `http://localhost:5001/api/roads/nearby?lat=${lat}&lng=${lng}&radius=100`;
        console.log(`Fetching: ${url}`);

        // Handle Axios import quirk if any
        const api = axios.default || axios;

        const response = await api.get(url);
        console.log('Response Status:', response.status);
        console.log('Road Segments Found:', response.data.roads ? response.data.roads.length : 0);

        if (response.data.roads && response.data.roads.length > 0) {
            console.log('Sample Segment Points:', response.data.roads[0].slice(0, 2));
        } else {
            console.log("Full Response:", JSON.stringify(response.data, null, 2));
        }

    } catch (error) {
        console.error('Error fetching roads:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
        }
    }
}

testRoads();
