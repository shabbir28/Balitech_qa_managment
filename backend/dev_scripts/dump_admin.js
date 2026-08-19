require('dotenv').config();

function getDialerConfig(type) {
  if (type === 'medicare') {
    const rawUrl = process.env.MEDICARE_DIALER_URL || 'https://balitgpt7s.dialerhosting.com/z6IRf9c/admin.php';
    return {
      baseUrl: rawUrl.includes('.php') ? rawUrl.replace(/\/[^\/]+$/, '') : rawUrl,
      user: process.env.MEDICARE_DIALER_USER || 'CRM_API',
      pass: process.env.MEDICARE_DIALER_PASS || 'CRM_APIadsfad',
      name: 'Medicare Dialer'
    };
  }
  const rawUrl = process.env.PHARMACY_DIALER_URL || process.env.DIALER_API_URL || 'https://bt1.dialerhosting.com/BkLuyT/admin.php';
  return {
    baseUrl: rawUrl.includes('.php') ? rawUrl.replace(/\/[^\/]+$/, '') : rawUrl,
    user: process.env.PHARMACY_DIALER_USER || process.env.DIALER_API_USER || 'CRM_API2',
    pass: process.env.PHARMACY_DIALER_PASS || process.env.DIALER_API_PASS || 'test123dssddscc',
    name: 'Pharmacy Dialer'
  };
}

async function fetchAdminPage(path, dialerType = 'pharmacy', method = 'GET', body = null) {
  const config = getDialerConfig(dialerType);
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const url = path.startsWith('http') ? path : `${baseUrl}/${path}`;
  const authHeader = 'Basic ' + Buffer.from(`${config.user}:${config.pass}`).toString('base64');
  
  const options = {
    method,
    headers: { Authorization: authHeader },
    signal: AbortSignal.timeout(15000),
  };
  if (body && method === 'POST') {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = body;
  }
  
  const res = await fetch(url, options);
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Authentication failed for ${config.name} Admin`);
  }
  return await res.text();
}

async function run() {
  try {
    const searchHtml = await fetchAdminPage('admin_search_lead.php', 'medicare');
    require('fs').writeFileSync('search_form.html', searchHtml);
    console.log('Saved search_form.html');

    const campaignsHtml = await fetchAdminPage('admin.php?ADD=10', 'medicare');
    require('fs').writeFileSync('campaigns.html', campaignsHtml);
    console.log('Saved campaigns.html');

  } catch (err) {
    console.error(err);
  }
}

run();
