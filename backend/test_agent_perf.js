require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function testAgentPerf() {
  try {
    const dialer = 'medicare';
    const params = new URLSearchParams();
    params.append('query_date', '2026-08-24');
    params.append('end_date', '2026-08-24');
    params.append('query_date_D', '2026-08-24');
    params.append('query_date_T', '00:00:00');
    params.append('end_date_D', '2026-08-24');
    params.append('end_date_T', '23:59:59');
    params.append('group[]', '--ALL--');
    params.append('user_group[]', '--ALL--');
    params.append('users[]', '--ALL--');
    params.append('shift', '--');
    params.append('display_as', 'TEXT');
    params.append('search_archived_data', 'checked');
    params.append('SUBMIT', 'SUBMIT');
    
    console.log('Fetching AST_agent_performance_detail.php...');
    const html = await fetchAdminPage('AST_agent_performance_detail.php', dialer, 'POST', params.toString());
    
    // Look for D5 in the bottom totals row
    // The report usually has a row at the very bottom with totals.
    // Let's just print out how big the HTML is.
    console.log('HTML length:', html.length);
    
    const d5Match = html.match(/D5[\s\S]{0,100}?961/i);
    if (d5Match) {
      console.log('Found 961 inside the report output near D5!');
    }
    
    // Also we can save it to a file if needed.
    const fs = require('fs');
    fs.writeFileSync('agent_perf_report.html', html);
    console.log('Saved to agent_perf_report.html');
  } catch (err) {
    console.error(err);
  }
}
testAgentPerf();
