require('dotenv').config();
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function checkPermissions() {
  try {
    const dialer = 'medicare';
    const user = process.env.MEDICARE_DIALER_USER;
    
    console.log(`Checking permissions for user ${user}...`);
    
    // Fetch the user modification page for this user
    const html = await fetchAdminPage(`admin.php?ADD=3&user=${user}`, dialer, 'GET');
    
    const userGroupMatch = html.match(/name=["']?user_group["']?[^>]*value=["']?([^"'>\s]+)["']?/i);
    console.log('User Group:', userGroupMatch ? userGroupMatch[1] : 'Unknown');
    
    const adminMatch = html.match(/name=["']?user_level["']?[^>]*value=["']?([^"'>\s]+)["']?/i);
    console.log('User Level:', adminMatch ? adminMatch[1] : 'Unknown');
    
    // See if they have campaign restrictions
    if (html.includes('Allowed Campaigns')) {
      const match = html.match(/Allowed Campaigns([\s\S]*?)<\/td>/i);
      if (match) {
        console.log('Allowed Campaigns restriction exists in HTML.');
      }
    }
  } catch (err) {
    console.error(err);
  }
}
checkPermissions();
