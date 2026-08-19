const { fetchAdminPage } = require('./src/controllers/dialerController');
async function test() {
  const html = await fetchAdminPage('admin_search_lead.php', 'pharmacy', 'GET');
  const inputs = html.match(/<input[^>]+name=['"]([^'"]+)['"][^>]*>/gi);
  if(inputs) {
    inputs.forEach(i => {
      const match = i.match(/name=['"]([^'"]+)['"]/);
      if(match && match[1].includes('date')) console.log('Found date input:', match[1]);
    });
  }
}
test();
