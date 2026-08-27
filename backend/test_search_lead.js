require('dotenv').config();
const { fetchAdminPage, extractLeadsFromHtml } = require('./src/controllers/dialerController');

async function testAdminSearchLead() {
  try {
    const dialer = 'medicare';
    const body = new URLSearchParams({
      status: 'D5',
      SUBMIT: 'SUBMIT'
    }).toString();
    
    console.log('Fetching admin_search_lead.php for D5...');
    const html = await fetchAdminPage('admin_search_lead.php', dialer, 'POST', body);
    console.log('HTML size:', html.length);
    
    const leads = extractLeadsFromHtml(html);
    console.log('Total extracted D5 leads:', leads.length);
    
    // Filter by yesterday
    const targetDate = '2026-08-24';
    const filtered = leads.filter(l => {
      if (!l.last_call || l.last_call.length < 10) return false;
      const d = l.last_call.substring(0, 10);
      return d === targetDate;
    });
    
    console.log(`Leads matching ${targetDate}:`, filtered.length);
    
  } catch (err) {
    console.error(err);
  }
}
testAdminSearchLead();
