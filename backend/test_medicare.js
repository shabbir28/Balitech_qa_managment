const { fetchAdminPage } = require('./src/controllers/dialerController');
const fs = require('fs');

async function testMedicare() {
  try {
    const sysHtml = await fetchAdminPage('admin.php?ADD=321111111111111', 'medicare');
    fs.writeFileSync('medicare_sys.html', sysHtml);
    console.log('Saved medicare_sys.html, size:', sysHtml.length);
    
    // Also check campaign 001 for medicare just in case
    const campHtml = await fetchAdminPage('admin.php?ADD=10', 'medicare');
    fs.writeFileSync('medicare_camp.html', campHtml);
    console.log('Saved medicare_camp.html, size:', campHtml.length);
    
  } catch(e) {
    console.error('Error fetching medicare:', e);
  }
}

testMedicare();
