const { getSales } = require('./src/controllers/dialerSalesController');
const { fetchAdminPage } = require('./src/controllers/dialerController');

// Mock req and res
const req = {
  query: { dialer: 'pharmacy' } // Test pharmacy
};

const res = {
  json: (data) => console.log('RESPONSE:', JSON.stringify(data, null, 2)),
  status: (code) => {
    console.log('STATUS:', code);
    return {
      json: (data) => console.log('ERROR RESPONSE:', JSON.stringify(data, null, 2))
    };
  }
};

async function test() {
  console.log('Testing getSales for pharmacy...');
  await getSales(req, res);
  
  console.log('\nTesting getSales for medicare...');
  req.query.dialer = 'medicare';
  await getSales(req, res);
}

test().catch(console.error);
