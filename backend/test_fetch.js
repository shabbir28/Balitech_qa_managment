const AUTH_HEADER = 'Basic ' + Buffer.from('CRM_API:test123dssddscc').toString('base64');
const DIALER_BASE = 'https://bt1.dialerhosting.com/BkLuyT';
async function fetchAdminPage(path, method = 'GET', body = null) {
  const url = path.startsWith('http') ? path : `${DIALER_BASE}/${path}`;
  const options = {
    method,
    headers: { Authorization: AUTH_HEADER },
  };
  if (body && method === 'POST') {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = body;
  }
  const res = await fetch(url, options);
  return await res.text();
}
function extractLeadsFromHtml(html) {
  const leads = [];
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows) return leads;
  for (const rowHtml of rows) {
    if (rowHtml.includes('admin_modify_lead.php?lead_id=')) {
      const tdMatches = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (tdMatches && tdMatches.length >= 10) {
        const clean = (td) => td.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        leads.push({
          lead_id:    clean(tdMatches[1]),
          status:     clean(tdMatches[2]),
          vendor_id:  clean(tdMatches[3]),
          last_agent: clean(tdMatches[4]),
          list_id:    clean(tdMatches[5]),
          phone:      clean(tdMatches[6]),
          name:       clean(tdMatches[7]),
          city:       clean(tdMatches[8]),
          security:   clean(tdMatches[9]),
          last_call:  clean(tdMatches[10] || ''),
        });
      } else {
        console.log('TDS LENGTH WAS:', tdMatches ? tdMatches.length : 0);
      }
    }
  }
  return leads;
}
const body = new URLSearchParams({ phone: '9899007269', SUBMIT: 'SUBMIT' }).toString();
fetchAdminPage('admin_search_lead.php', 'POST', body).then(html => {
  const leads = extractLeadsFromHtml(html);
  console.log('LEADS:', JSON.stringify(leads, null, 2));
});
