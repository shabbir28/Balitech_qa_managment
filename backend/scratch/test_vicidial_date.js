const { fetchAdminPage } = require('../src/controllers/dialerController');
require('dotenv').config();

async function main() {
  const params = new URLSearchParams();
  params.append('run_export', '1');
  params.append('query_date', '2026-08-19');
  params.append('end_date', '2026-08-19'); // TEST EXACT DATE
  params.append('campaign[]', '--ALL--');
  params.append('group[]', '--ALL--');
  params.append('header_row', 'Y');
  params.append('rec_fields', 'N');
  params.append('export_fields', 'STANDARD');
  params.append('SUBMIT', 'SUBMIT');
  
  const statuses = ['D5', 'D3', 'D4', 'D2', 'D6CPL', 'D5B', 'D1', 'HIB', 'HIMAIN'];
  statuses.forEach(s => params.append('status[]', s));

  const tsvData = await fetchAdminPage('call_report_export.php', 'medicare', 'POST', params.toString());
  
  const lines = tsvData.split('\n');
  let count19 = 0;
  for (const line of lines) {
    if (line.startsWith('2026-08-19')) count19++;
  }
  console.log(`TSV Lines: ${lines.length}. Lines starting with 2026-08-19: ${count19}`);
}
main();
