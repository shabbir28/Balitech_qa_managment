const assert = require('node:assert/strict');
const { campaignIds, parsePresets, mergePresets } = require('../src/utils/dialerPresets');
const { laRecording } = require('../src/utils/laRecordings');
const page = (name, number) => `1 PRESETS FOR THIS CAMPAIGN
 <tr><td><input name=preset_name value="${name}"></td>
 <td><input value="${number}" name='preset_number'></td></tr>`;
assert.deepEqual(campaignIds('<a href="admin.php?ADD=31&amp;campaign_id=002">A</a><a href="admin.php?ADD=31&campaign_id=002">B</a>'), ['002']);
assert.deepEqual(parsePresets(page('D5 &amp; LA', '+1 (866) 482-6418')), { '8664826418': 'D5 & LA' });
assert.deepEqual(parsePresets('0 PRESETS FOR THIS CAMPAIGN'), {});
assert.deepEqual(parsePresets(page('Internal', '7001')), {});
assert.throws(() => parsePresets('Permission denied'));
assert.throws(() => parsePresets('2 PRESETS FOR THIS CAMPAIGN' + page('D5', '8664826418')));
assert.throws(() => campaignIds('Login required'));
const original = { '8664826418': { name: 'D5', retiredOn: null } };
const updated = mergePresets(original, { '8005550100': 'New LA' }, '2026-10-21');
const rec = (did, date) => ({ filename: `call_941621${did}.mp3`, date, length: '900' });
assert.ok(laRecording(rec('8664826418', '2026-10-20 12:00:00'), updated));
assert.equal(laRecording(rec('8664826418', '2026-10-22 12:00:00'), updated), null);
assert.equal(laRecording(rec('8005550100', '2026-10-22 12:00:00'), updated).disposition, 'New LA');
assert.equal(laRecording(rec('8005550100', '2026-10-22 12:00:00'), {}), null);

// Exercise refresh/failure behavior without contacting a dialer or database.
const saved = new Map();
let report = page('D5', '8664826418');
let reads = 0;
require.cache[require.resolve('../src/config/database')] = { exports: {
  query: async (sql, params) => {
    if (sql.startsWith('SELECT')) return { rows: saved.has(params[0]) ? [saved.get(params[0])] : [] };
    saved.set(params[0], { presets: JSON.parse(params[1]), checked_at: new Date() });
    return { rows: [] };
  },
} };
require.cache[require.resolve('../src/controllers/dialerController')] = { exports: {
  fetchAdminPage: async path => {
    reads++;
    return path === 'admin.php?ADD=10' ? '<a href="admin.php?ADD=31&campaign_id=002">Campaign</a>' : report;
  },
} };
(async () => {
  let service = require('../src/services/dialerPresetService');
  await Promise.all([service.refreshDialerDids('medicare'), service.refreshDialerDids('medicare')]);
  assert.equal(reads, 2, 'Concurrent refreshes must share one fetch');
  assert.equal((await service.getDialerDids('medicare')).presets['8664826418'].name, 'D5');
  report = page('New destination', '8005550100');
  await service.refreshDialerDids('medicare');
  const beforeFailure = JSON.stringify(saved.get('medicare'));
  report = 'Permission denied';
  await assert.rejects(service.refreshDialerDids('medicare'));
  assert.equal(JSON.stringify(saved.get('medicare')), beforeFailure, 'Failure must preserve the complete last-known snapshot');
  assert.equal((await service.getDialerDids('medicare')).failed, true);
  // A fresh service instance must load its persisted registry after a restart.
  delete require.cache[require.resolve('../src/services/dialerPresetService')];
  service = require('../src/services/dialerPresetService');
  assert.equal((await service.getDialerDids('medicare')).presets['8005550100'].name, 'New destination');
  console.log('PASS: live-format parsing, number normalization, malformed/empty pages, new/retired DIDs, single-flight refresh, failure preservation, restart persistence.');
})().catch(error => { console.error(error); process.exitCode = 1; });
