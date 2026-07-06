const AUTH = 'Basic ' + Buffer.from('CRM_API:test123dssddscc').toString('base64');
const BASE = 'https://bt1.dialerhosting.com/BkLuyT';

// POST form with correct field name: 'phone' (not 'phone_number')
fetch(`${BASE}/admin_search_lead.php`, {
  method: 'POST',
  headers: {
    Authorization: AUTH,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({ phone: '9899007269', SUBMIT: 'SUBMIT' }).toString(),
})
  .then(r => r.text())
  .then(html => {
    // Look for lead data in table rows
    const rows = html.match(/<tr[^>]*>[\s\S]{0,600}<\/tr>/gi) || [];
    console.log('Total rows found:', rows.length);
    rows.forEach((r, i) => {
      const t = r.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (t.length > 15 && !t.includes('Lead Search Options') && !t.includes('SUBMIT')) {
        console.log('ROW' + i + ':', t.substring(0, 300));
      }
    });

    const links = html.match(/href="[^"]*lead_id=[^"]+"/gi);
    console.log('\nLEAD LINKS:', links ? links.slice(0, 5) : 'none');

    require('fs').writeFileSync('dialer_debug2.html', html);
    console.log('\nSaved. HTML length:', html.length);
  })
  .catch(e => console.log('ERR:', e.message));
