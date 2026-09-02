require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function testExportGroups() {
  try {
    const dialer = 'medicare';
    const html = await fetchAdminPage('call_report_export.php', dialer, 'GET');
    
    // Extract groups (Inbound groups)
    const groups = [];
    const ugMatch = html.match(/<select[^>]*name=["']?group\[\]["']?[^>]*>([\s\S]*?)<\/select>/i);
    if (ugMatch) {
      const opts = ugMatch[1].match(/<option[^>]*value=["']?([^"'>\s]+)["']?/gi);
      if (opts) {
         opts.forEach(o => {
           const val = o.match(/value=["']?([^"'>\s]+)["']?/i)[1];
           if (val !== '--ALL--' && val !== '---NONE---') groups.push(val);
         });
      }
    }
    
    console.log(`Found ${groups.length} inbound groups`);
    
    const params = new URLSearchParams();
    params.append('run_export', '1');
    params.append('query_date', '2026-08-24');
    params.append('end_date', '2026-08-24');
    
    params.append('campaign[]', '--ALL--');
    
    // Pass inbound groups explicitly
    groups.forEach(g => params.append('group[]', g));
    
    params.append('header_row', 'Y');
    params.append('rec_fields', 'N');
    params.append('export_fields', 'STANDARD');
    params.append('search_archived_data', 'checked');
    params.append('SUBMIT', 'SUBMIT');
    params.append('status[]', 'D5');
    
    const tsvData = await fetchAdminPage('call_report_export.php', dialer, 'POST', params.toString());
    const lines = tsvData.split('\n');
    console.log('Total TSV lines for D5 with explicit inbound groups:', lines.length);
    
  } catch (err) {
    console.error(err);
  }
}
testExportGroups();
