require('dotenv').config();
const { syncStatuses } = require('./src/controllers/dialerSalesController');

async function test() {
  console.log("Testing syncStatuses manually for 'medicare'");
  
  const req = { body: { dialer: 'medicare' } };
  const res = {
    json: (data) => console.log('Response:', JSON.stringify(data, null, 2)),
    status: (code) => ({ json: (data) => console.log('Error', code, data) })
  };

  await syncStatuses(req, res);
}

test();
