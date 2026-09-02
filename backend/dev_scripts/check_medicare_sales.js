const { fetchAdminPage } = require('../src/controllers/dialerController');
require('dotenv').config();

async function main() {
  try {
    const params = new URLSearchParams();
    params.append('run_export', '1');
    params.append('query_date', '2026-08-19');
    params.append('end_date', '2026-08-20'); // Note: Vicidial might require today
    params.append('campaign[]', '--ALL--');
    params.append('group[]', '--ALL--');
    params.append('status[]', '--ALL--'); // Let's see if ALL works
    params.append('header_row', 'Y');
    params.append('rec_fields', 'N');
    params.append('export_fields', 'STANDARD');
    params.append('SUBMIT', 'SUBMIT');

    const tsvData = await fetchAdminPage('call_report_export.php', 'medicare', 'POST', params.toString());
    
    const lines = tsvData.split('\n');
    let count = 0;
    let countsByStatus = {};
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length >= 10 && cols[0] && cols[0].trim().startsWith('2026-08-19')) {
        count++;
        const status = cols[2] ? cols[2].trim() : 'UNKNOWN';
        countsByStatus[status] = (countsByStatus[status] || 0) + 1;
      }
    }
    console.log(`Total found on 2026-08-19: ${count}`);
    console.log('Counts by Status:', countsByStatus);
  } catch (err) {
    console.error(err);
  }
}
main();
