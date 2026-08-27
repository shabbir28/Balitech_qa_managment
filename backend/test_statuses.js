require('dotenv').config();
const fs = require('fs');
const { fetchAdminPage } = require('./src/controllers/dialerController');
const { getSales } = require('./src/controllers/dialerSalesController');

// We just want to extract the getSaleStatuses logic from dialerSalesController.js
const content = fs.readFileSync('src/controllers/dialerSalesController.js', 'utf8');

const fetchRegex = /async function getSaleStatuses[\s\S]*?return result;\s*}/;
const match = content.match(fetchRegex);

const parseRegex = /function parseStatusesHtml[\s\S]*?}\s*}/;
const parseMatch = content.match(parseRegex);

const saleStatusesCache = {
  pharmacy: { statuses: null, lastFetched: 0 },
  medicare: { statuses: null, lastFetched: 0 }
};
const CACHE_TTL = 60 * 60 * 1000;

eval(parseMatch[0] + '\n' + match[0]);

getSaleStatuses('medicare').then(res => {
  console.log('MEDICARE STATUSES:', res);
  process.exit(0);
}).catch(console.error);
