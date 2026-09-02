require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function testExport() {
  try {
    const dialer = 'medicare';
    const html = await fetchAdminPage('call_report_export.php', dialer, 'GET', null);
    
    // Find the search_archived_data input
    const match = html.match(/<input[^>]*name=["']?search_archived_data["']?[^>]*>/i);
    if (match) {
      console.log('Found search_archived_data input:', match[0]);
    } else {
      console.log('No search_archived_data input found!');
    }
  } catch (err) {
    console.error(err);
  }
}
testExport();
