require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function testExport() {
  try {
    const dialer = 'medicare';
    const params = new URLSearchParams();
    params.append('run_export', '1');
    params.append('query_date', '2026-08-24');
    params.append('end_date', '2026-08-24');
    params.append('campaign[]', '--ALL--');
    params.append('group[]', '--ALL--');
    params.append('header_row', 'Y');
    params.append('rec_fields', 'N');
    params.append('export_fields', 'STANDARD');
    params.append('search_archived_data', 'checked');
    params.append('SUBMIT', 'SUBMIT');
    
    // Pass multiple
    const statuses = ['D5', 'D5B', 'D4', 'D6CPL', 'D8', 'D7', 'D1'];
    statuses.forEach(s => params.append('status[]', s));
    
    const tsvData = await fetchAdminPage('call_report_export.php', dialer, 'POST', params.toString());
    const lines = tsvData.split('\n');
    console.log('Total TSV lines exported:', lines.length);
    
  } catch (err) {
    console.error(err);
  }
}
testExport();
