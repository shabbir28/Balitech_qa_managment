require('dotenv').config({ path: 'd:/Balitech_qa_managment/backend/.env' });
const { fetchAdminPage } = require('../src/controllers/dialerController');

async function debugTopAgents() {
  console.log('=== Checking Medicare Dialer Sales for Today ===');
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStr = formatter.format(new Date());
  console.log('Today (EST):', todayStr);

  // 1. Check Medicare call_report_export
  try {
    const params = new URLSearchParams();
    params.append('run_export', '1');
    params.append('query_date', todayStr);
    params.append('end_date', todayStr);
    params.append('campaign[]', '--ALL--');
    params.append('group[]', '--ALL--');
    params.append('header_row', 'Y');
    params.append('rec_fields', 'N');
    params.append('export_fields', 'STANDARD');
    params.append('SUBMIT', 'SUBMIT');

    // Add common statuses
    const testStatuses = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'SALE', 'XFER', 'CALLBK', 'A', 'B'];
    testStatuses.forEach(s => params.append('status[]', s));

    const tsvData = await fetchAdminPage('call_report_export.php', 'medicare', 'POST', params.toString());
    const lines = tsvData.split('\n');
    console.log('Medicare export total lines:', lines.length);

    const agentCounts = {};
    lines.forEach(line => {
      const cols = line.split('\t');
      if (cols.length >= 5 && cols[0].startsWith('20')) {
        const status = cols[2];
        const user = cols[3];
        const fullName = cols[4];
        const agentKey = `${user} - ${fullName}`;
        if (!agentCounts[agentKey]) agentCounts[agentKey] = { total: 0, statuses: {} };
        agentCounts[agentKey].total++;
        agentCounts[agentKey].statuses[status] = (agentCounts[agentKey].statuses[status] || 0) + 1;
      }
    });

    console.log('\n--- Top Medicare Agents Today (from call_report_export.php) ---');
    const sorted = Object.entries(agentCounts).sort((a, b) => b[1].total - a[1].total);
    sorted.slice(0, 15).forEach(([agent, data], idx) => {
      console.log(`${idx + 1}. ${agent}: ${data.total} (Statuses: ${JSON.stringify(data.statuses)})`);
    });

  } catch (err) {
    console.error('Error fetching Medicare:', err.message);
  }

  // 2. Check Pharmacy call_report_export or admin_search_lead
  console.log('\n=== Checking Pharmacy Dialer ===');
  try {
    const params = new URLSearchParams();
    params.append('run_export', '1');
    params.append('query_date', todayStr);
    params.append('end_date', todayStr);
    params.append('campaign[]', '--ALL--');
    params.append('group[]', '--ALL--');
    params.append('header_row', 'Y');
    params.append('rec_fields', 'N');
    params.append('export_fields', 'STANDARD');
    params.append('SUBMIT', 'SUBMIT');
    params.append('status[]', 'SALE');
    params.append('status[]', 'XFER');
    params.append('status[]', 'D4');
    params.append('status[]', 'D5');

    const tsvData = await fetchAdminPage('call_report_export.php', 'pharmacy', 'POST', params.toString());
    const lines = tsvData.split('\n');
    console.log('Pharmacy export lines:', lines.length);
    const pharmAgentCounts = {};
    lines.forEach(line => {
      const cols = line.split('\t');
      if (cols.length >= 5 && cols[0].startsWith('20')) {
        const status = cols[2];
        const user = cols[3];
        const fullName = cols[4];
        const agentKey = `${user} - ${fullName}`;
        if (!pharmAgentCounts[agentKey]) pharmAgentCounts[agentKey] = { total: 0, statuses: {} };
        pharmAgentCounts[agentKey].total++;
        pharmAgentCounts[agentKey].statuses[status] = (pharmAgentCounts[agentKey].statuses[status] || 0) + 1;
      }
    });
    console.log('\n--- Top Pharmacy Agents Today ---');
    Object.entries(pharmAgentCounts).sort((a, b) => b[1].total - a[1].total).slice(0, 10).forEach(([agent, data], idx) => {
      console.log(`${idx + 1}. ${agent}: ${data.total} (${JSON.stringify(data.statuses)})`);
    });
  } catch (err) {
    console.error('Error fetching Pharmacy:', err.message);
  }
}

debugTopAgents().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
