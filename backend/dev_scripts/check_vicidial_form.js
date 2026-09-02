const { fetchAdminPage } = require('../src/controllers/dialerController');
require('dotenv').config();

async function main() {
  const html = await fetchAdminPage('call_report_export.php', 'medicare', 'GET');
  console.log(html.substring(0, 2000));
  const inputs = html.match(/<input[^>]+>/gi) || [];
  inputs.forEach(i => console.log(i));
  const selects = html.match(/<select[^>]+>/gi) || [];
  selects.forEach(i => console.log(i));
}
main();
