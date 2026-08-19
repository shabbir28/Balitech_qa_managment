require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function test() {
  const params = new URLSearchParams();
  params.append('run_export', '1');
  params.append('query_date', '2026-08-12');
  params.append('end_date', '2026-08-12');
  params.append('campaign[]', '--ALL--');
  params.append('group[]', '--ALL--');
  params.append('header_row', 'Y');
  params.append('rec_fields', 'N');
  params.append('export_fields', 'STANDARD');
  params.append('SUBMIT', 'SUBMIT');

  console.log('Fetching for Aug 12 without status filter...');
  const tsvData = await fetchAdminPage('call_report_export.php', 'medicare', 'POST', params.toString());
  const lines = tsvData.split('\n');
  console.log(`Received ${lines.length} lines.`);
  if (lines.length > 2) {
    console.log("Line 1:", lines[1]);
  }
}
test();
