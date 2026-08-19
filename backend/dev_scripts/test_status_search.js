require('dotenv').config();
const { fetchAdminPage, extractLeadsFromHtml } = require('./src/controllers/dialerController');

async function test() {
  const dialer = 'pharmacy';
  const status = 'SALE'; // Replace with a known status
  console.log(`Searching for status: ${status} in ${dialer}`);
  
  const body = new URLSearchParams({ status: status, SUBMIT: 'SUBMIT' }).toString();
  const html = await fetchAdminPage('admin_search_lead.php', dialer, 'POST', body);
  
  require('fs').writeFileSync('search_status_test.html', html);
  console.log('HTML saved to search_status_test.html');
  
  const leads = extractLeadsFromHtml(html);
  console.log(`Extracted leads: ${leads.length}`);
  console.log(leads.slice(0, 2));
}

test();
