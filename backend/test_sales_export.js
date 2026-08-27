require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function testExportDeep() {
  try {
    const dialer = 'medicare';
    const html = await fetchAdminPage('AST_VDsales_export.php', dialer, 'GET');
    console.log('AST_VDsales_export.php response length:', html.length);
    if (html.length < 500) {
      console.log('Response:', html.substring(0, 200));
    }
  } catch (err) {
    console.error(err);
  }
}
testExportDeep();
