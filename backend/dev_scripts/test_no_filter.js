require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function testExportNoFilter() {
  try {
    const dialer = 'medicare';
    const params = new URLSearchParams();
    params.append('run_export', '1');
    params.append('query_date', '2026-08-24');
    params.append('end_date', '2026-08-24');
    
    // Do NOT pass campaign[] or group[] to see if it bypasses restrictions
    params.append('header_row', 'Y');
    params.append('rec_fields', 'N');
    params.append('export_fields', 'STANDARD');
    params.append('search_archived_data', 'checked');
    params.append('SUBMIT', 'SUBMIT');
    params.append('status[]', 'D5');
    
    const tsvData = await fetchAdminPage('call_report_export.php', dialer, 'POST', params.toString());
    const lines = tsvData.split('\n');
    console.log('Total lines exported WITHOUT campaign/group params:', lines.length);
  } catch (err) {
    console.error(err);
  }
}
testExportNoFilter();
