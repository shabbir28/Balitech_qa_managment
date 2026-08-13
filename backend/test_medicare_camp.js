const { fetchAdminPage } = require('./src/controllers/dialerController'); 
async function test() { 
  const campHtml = await fetchAdminPage('admin.php?ADD=10', 'medicare'); 
  const campRows = campHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi); 
  const campaigns = new Set(); 
  if (campRows) { 
    for (const row of campRows) { 
      if (row.includes('campaign_id=')) { 
        const match = row.match(/campaign_id=([^"'>&\s]+)/); 
        if (match) campaigns.add(match[1]); 
      } 
    } 
  } 
  console.log('Camps:', [...campaigns]); 
  let total = 0; 
  for (const c of campaigns) { 
    const cHtml = await fetchAdminPage(`admin.php?ADD=34&campaign_id=${c}&custom_report_1=1`, 'medicare'); 
    const m = cHtml.match(/name=["']?sale["']?[\s\S]*?<\/select>/gi); 
    if (m) { 
      total += m.length; 
      console.log(c, 'has', m.length, 'dropdowns'); 
    } 
    if (cHtml.includes('You do not have permission')) console.log(c, 'NO PERMISSION'); 
  } 
  console.log('Total sale dropdowns:', total); 
} 
test();
