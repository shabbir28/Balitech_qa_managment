require('dotenv').config({ path: 'd:/Balitech_qa_managment/backend/.env' });
const { fetchAdminPage } = require('../src/controllers/dialerController');

async function checkExactSales() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStr = formatter.format(new Date());
  console.log('Today (EST):', todayStr);

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

  // Let's query ONLY Sale statuses D1..D6, SALE, etc.
  const saleStatuses = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'SALE', 'XFER'];
  saleStatuses.forEach(s => params.append('status[]', s));

  const tsvData = await fetchAdminPage('call_report_export.php', 'medicare', 'POST', params.toString());
  const lines = tsvData.split('\n');
  console.log('Medicare sale lines count:', lines.length);

  const agentCounts = {};
  const sampleLeads = {};

  lines.forEach(line => {
    const cols = line.split('\t');
    if (cols.length >= 6 && cols[0].startsWith('20')) {
      const callDate = cols[0];
      const phone = cols[1];
      const status = cols[2];
      const user = cols[3];
      const fullName = cols[4];
      const campaign = cols[5];
      const userGroup = cols.length > 31 ? cols[31] : '';

      const agentKey = `${user} - ${fullName}`;
      if (!agentCounts[agentKey]) {
        agentCounts[agentKey] = { total: 0, statuses: {}, campaign: campaign, userGroup: userGroup };
      }
      agentCounts[agentKey].total++;
      agentCounts[agentKey].statuses[status] = (agentCounts[agentKey].statuses[status] || 0) + 1;
      
      if (!sampleLeads[user]) {
        sampleLeads[user] = { callDate, phone, status, user, fullName, campaign, userGroup, lineLen: cols.length };
      }
    }
  });

  console.log('\n--- Top Performers on Medicare Dialer Today ---');
  const sorted = Object.entries(agentCounts).sort((a, b) => b[1].total - a[1].total);
  sorted.slice(0, 20).forEach(([agent, data], idx) => {
    console.log(`${idx + 1}. ${agent} [Group: ${data.userGroup}, Camp: ${data.campaign}]: Total = ${data.total} | Dispositions: ${JSON.stringify(data.statuses)}`);
  });

  console.log('\n--- Sample Records for specific users ---');
  ['7020', '5089', '7026', '5022', '5036', '5095', '2030', '6014', '6072', '5018', '5034'].forEach(u => {
    console.log(`User ${u}:`, sampleLeads[u] || 'NOT FOUND IN MEDICARE EXPORT');
  });
}

checkExactSales().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
