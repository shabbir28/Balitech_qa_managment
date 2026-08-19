const { getSaleStatuses, getSales } = require('./src/controllers/dialerSalesController');
const { fetchAdminPage } = require('./src/controllers/dialerController');
require('dotenv').config();

async function test() {
    try {
        console.log("Testing pharmacy statuses...");
        const sysHtml = await fetchAdminPage('admin.php?ADD=321111111111111', 'pharmacy');
        console.log("SysHtml length:", sysHtml.length);
        const req = { query: { dialer: 'pharmacy', timeFilter: 'TODAY' } };
        const res = { 
            json: (data) => console.log(JSON.stringify(data, null, 2)), 
            status: (code) => ({ json: (data) => console.log(code, data) })
        };
        await getSales(req, res);
    } catch(e) {
        console.error(e);
    }
}
test();
