require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function testExportDeep() {
  try {
    const dialer = 'medicare';
    
    // First, fetch the export page HTML to extract all possible campaigns, user groups, and lists
    const html = await fetchAdminPage('call_report_export.php', dialer, 'GET');
    
    // Extract campaigns
    const campaigns = [];
    const campMatch = html.match(/<select[^>]*name=["']?campaign\[\]["']?[^>]*>([\s\S]*?)<\/select>/i);
    if (campMatch) {
      const opts = campMatch[1].match(/<option[^>]*value=["']?([^"'>\s]+)["']?/gi);
      if (opts) {
         opts.forEach(o => {
           const val = o.match(/value=["']?([^"'>\s]+)["']?/i)[1];
           if (val !== '--ALL--' && val !== '---NONE---') campaigns.push(val);
         });
      }
    }
    
    // Extract user groups
    const userGroups = [];
    const ugMatch = html.match(/<select[^>]*name=["']?user_group\[\]["']?[^>]*>([\s\S]*?)<\/select>/i);
    if (ugMatch) {
      const opts = ugMatch[1].match(/<option[^>]*value=["']?([^"'>\s]+)["']?/gi);
      if (opts) {
         opts.forEach(o => {
           const val = o.match(/value=["']?([^"'>\s]+)["']?/i)[1];
           if (val !== '--ALL--' && val !== '---NONE---') userGroups.push(val);
         });
      }
    }
    
    // Extract lists
    const lists = [];
    const listMatch = html.match(/<select[^>]*name=["']?list_id\[\]["']?[^>]*>([\s\S]*?)<\/select>/i);
    if (listMatch) {
      const opts = listMatch[1].match(/<option[^>]*value=["']?([^"'>\s]+)["']?/gi);
      if (opts) {
         opts.forEach(o => {
           const val = o.match(/value=["']?([^"'>\s]+)["']?/i)[1];
           if (val !== '--ALL--' && val !== '---NONE---') lists.push(val);
         });
      }
    }
    
    console.log(`Found ${campaigns.length} campaigns, ${userGroups.length} user groups, ${lists.length} lists`);
    
    const params = new URLSearchParams();
    params.append('run_export', '1');
    params.append('query_date', '2026-08-24');
    params.append('end_date', '2026-08-24');
    
    // Pass everything individually to bypass `--ALL--` bugs
    campaigns.forEach(c => params.append('campaign[]', c));
    userGroups.forEach(g => params.append('user_group[]', g));
    lists.forEach(l => params.append('list_id[]', l));
    
    params.append('header_row', 'Y');
    params.append('rec_fields', 'N');
    params.append('export_fields', 'STANDARD');
    params.append('search_archived_data', 'checked');
    params.append('SUBMIT', 'SUBMIT');
    params.append('status[]', 'D5');
    
    const tsvData = await fetchAdminPage('call_report_export.php', dialer, 'POST', params.toString());
    const lines = tsvData.split('\n');
    console.log('Total TSV lines for D5 with explicit params:', lines.length);
    
  } catch (err) {
    console.error(err);
  }
}
testExportDeep();
