require('dotenv').config();
const { getSales, syncStatuses } = require('./src/controllers/dialerSalesController');
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function test() {
  console.log("Testing syncStatuses manually for 'pharmacy'");
  
  // Fake req/res for controller method
  const req = { body: { dialer: 'pharmacy' } };
  const res = {
    json: (data) => console.log('Response:', JSON.stringify(data, null, 2)),
    status: (code) => ({ json: (data) => console.log('Error', code, data) })
  };

  await syncStatuses(req, res);
}

test();
