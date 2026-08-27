require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function testExportMissed() {
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
    params.append('status[]', 'D5');
    
    const tsvData = await fetchAdminPage('call_report_export.php', dialer, 'POST', params.toString());
    const lines = tsvData.split('\n');
    console.log('Total lines exported:', lines.length);
    
    let valid = 0;
    let invalid = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.split('\t');
      if (cols[0] && cols[0].trim().startsWith('2026')) {
        valid++;
      } else {
        invalid++;
        if (invalid <= 10) console.log('INVALID ROW:', line.substring(0, 100));
      }
    }
    
    console.log(`Valid leads: ${valid}, Invalid rows: ${invalid}`);
  } catch (err) {
    console.error(err);
  }
}
testExportMissed();
