const fs = require('fs');

function parseStatusesHtml(html) {
  const statuses = new Set();
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows) return statuses;
  for (const row of rows) {
    if (row.includes('ADD=4') || row.includes('ADD=35')) {
      const cols = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (cols && cols.length >= 6) {
        const clean = (str) => str.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().replace(/\s+/g, ' ');
        const status = clean(cols[0]);
        const val4 = clean(cols[4]);
        console.log(`Status: '${status}', Col4: '${val4}', rawCol4: '${cols[4]}'`);
        if (val4 === 'Y') {
          statuses.add(status);
        }
      }
    }
  }
  return statuses;
}

const html = fs.readFileSync('system_statuses_medicare.html', 'utf8');
const result = parseStatusesHtml(html);
console.log('Result:', [...result]);
