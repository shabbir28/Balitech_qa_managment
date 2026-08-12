require('dotenv').config();

async function getSaleStatuses(dialerType = 'pharmacy') {
  try {
    console.log(`Fetching system statuses for ${dialerType}...`);
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

    const config = getDialerConfig(dialerType);
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/admin.php?ADD=3`;
    const authHeader = 'Basic ' + Buffer.from(`${config.user}:${config.pass}`).toString('base64');
    
    console.log('URL:', url);

    const res = await fetch(url, {
      headers: { Authorization: authHeader }
    });
    
    if (res.status === 401 || res.status === 403) {
      console.error('Authentication failed');
      return;
    }
    
    const html = await res.text();
    const fs = require('fs');
    fs.writeFileSync(`system_statuses_${dialerType}.html`, html);
    console.log('Saved to HTML file. Processing...');

    const statuses = [];
    const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    if (rows) {
      for (const row of rows) {
        if (row.includes('admin.php?ADD=4&status=')) {
          // This is a status row
          const cols = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
          if (cols && cols.length >= 6) {
            const clean = (str) => str.replace(/<[^>]*>/g, '').trim();
            const status = clean(cols[0]);
            const sale = clean(cols[4]);
            
            if (sale === 'Y') {
              statuses.push(status);
            }
          }
        }
      }
    }
    console.log('System Statuses with Sale=Y:', statuses);

  } catch (error) {
    console.error('Error:', error);
  }
}

getSaleStatuses('medicare');
