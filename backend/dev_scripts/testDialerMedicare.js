const { getSaleStatuses, getSales } = require('./src/controllers/dialerSalesController');
const { fetchAdminPage } = require('./src/controllers/dialerController');
require('dotenv').config();

async function test() {
    try {
        console.log("Testing medicare statuses...");
        const req = { query: { dialer: 'medicare', timeFilter: 'TODAY' } };
        const res = { 
            json: (data) => console.log("Response:", JSON.stringify(data).substring(0, 500) + '...'), 
            status: (code) => ({ json: (data) => console.log(code, data) })
        };
        await getSales(req, res);
    } catch(e) {
        console.error(e);
    }
}
test();
