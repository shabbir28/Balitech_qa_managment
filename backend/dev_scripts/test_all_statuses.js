require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function testExportAllStatuses() {
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
    
    // We DO NOT append status[] to get ALL statuses!
    
    console.log('Fetching all statuses from dialer...');
    const tsvData = await fetchAdminPage('call_report_export.php', dialer, 'POST', params.toString());
    const lines = tsvData.split('\n');
    console.log('Total lines exported:', lines.length);
    
    let headers = [];
    let statusCounts = {};
    
    for (const line of lines) {
      const cols = line.split('\t');
      
      if (headers.length === 0 && cols.length >= 10 && cols.some(c => c.toLowerCase().includes('call_date') || c.toLowerCase().includes('lead_id'))) {
        headers = cols.map(c => c.trim().toLowerCase());
        continue;
      }
      
      if (cols.length >= 10 && cols[0] && cols[0].trim().startsWith('20')) {
        let status = cols[2] ? cols[2].trim() : 'UNKNOWN';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }
    }
    
    // Sort status counts
    const sorted = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
    console.log('Status breakdown:');
    sorted.forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
  } catch (err) {
    console.error(err);
  }
}
testExportAllStatuses();
