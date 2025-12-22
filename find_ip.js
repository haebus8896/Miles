const { networkInterfaces } = require('os');

const nets = networkInterfaces();
const results = Object.create(null);

for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
            if (!results[name]) {
                results[name] = [];
            }
            results[name].push(net.address);
        }
    }
}

console.log('Your Local IP Addresses:');
console.log(JSON.stringify(results, null, 2));
console.log('\nIf you are using a physical device, update delivery-app/src/api/index.js with one of these IPs instead of 10.0.2.2');
