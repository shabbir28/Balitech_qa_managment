require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function testExport() {
  try {
    const dialer = 'medicare';
    const params = new URLSearchParams();
    params.append('run_export', '1');
    params.append('query_date', '2026-08-24');
    params.append('end_date', '2026-08-24');
    
    // Add all possible ALL flags to ensure no filter restricts the results
    params.append('campaign[]', '--ALL--');
    params.append('group[]', '--ALL--');
    params.append('user_group[]', '--ALL--');
    params.append('list_id[]', '--ALL--');
    
    params.append('header_row', 'Y');
    params.append('rec_fields', 'N');
    params.append('export_fields', 'STANDARD');
    params.append('search_archived_data', 'checked');
    params.append('SUBMIT', 'SUBMIT');
    
    // Just D5 for debugging
    params.append('status[]', 'D5');
    
    const tsvData = await fetchAdminPage('call_report_export.php', dialer, 'POST', params.toString());
    const lines = tsvData.split('\n');
    console.log('Total TSV lines exported with extra ALL params:', lines.length);
    
    let allLeads = [];
    let headers = [];
    
    for (const line of lines) {
      const cols = line.split('\t');
      if (headers.length === 0 && cols.length >= 10) {
        headers = cols.map(c => c.trim().toLowerCase());
        continue;
      }
      if (cols.length >= 10 && cols[0] && cols[0].trim().startsWith('20')) {
        allLeads.push(cols[0]);
      }
    }
    
    console.log('Parsed valid leads:', allLeads.length);
    
  } catch (err) {
    console.error(err);
  }
}
testExport();
