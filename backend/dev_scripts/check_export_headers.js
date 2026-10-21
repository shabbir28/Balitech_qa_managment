require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { fetchAdminPage } = require('../src/controllers/dialerController');

(async () => {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  for (const fields of ['STANDARD', 'EXTENDED']) {
    const params = new URLSearchParams({
      run_export: '1', query_date: day, end_date: day, header_row: 'Y', rec_fields: 'N',
      export_fields: fields, SUBMIT: 'SUBMIT',
    });
    params.append('campaign[]', '--ALL--');
    params.append('group[]', '--ALL--');
    params.append('status[]', 'D5');
    const tsv = await fetchAdminPage('call_report_export.php', 'medicare', 'POST', params.toString());
    const lines = tsv.split(/\r?\n/).filter(Boolean).slice(0, 3);
    console.log('\nFIELDS', fields, 'line0 start', JSON.stringify(lines[0]?.slice(0, 80)));
    lines.forEach((line, li) => {
      const cols = line.split('\t');
      console.log('line', li, 'ncols', cols.length);
      cols.forEach((c, i) => console.log(`  ${i}=${JSON.stringify(c.trim())}`));
    });
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
