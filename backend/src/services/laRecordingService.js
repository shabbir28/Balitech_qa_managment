const { query } = require('../config/database');
const { getRecordings } = require('../controllers/dialerController');
const { laRecording, durationBucket } = require('../utils/laRecordings');
const { getDialerDids } = require('./dialerPresetService');

// Shared bounded queue prevents dashboard polling from flooding the dialer.
const queued = new Set();
const failures = new Map();
const jobs = [];
let running = 0;
function drain() {
  while (running < 3 && jobs.length) {
    const { dialer, lead_id, key } = jobs.shift();
    running++;
    (async () => {
      let recordings;
      await getRecordings(
        { params: { leadId: lead_id }, query: { dialer } },
        { json: body => { recordings = body.data; } },
        error => { throw error; },
      );
      if (!Array.isArray(recordings)) throw new Error('Recording response unavailable');
      await query(`INSERT INTO dashboard_la_recordings (dialer, lead_id, recordings, checked_at, cache_version)
        VALUES ($1, $2, $3::jsonb, NOW(), 2) ON CONFLICT (dialer, lead_id)
        DO UPDATE SET recordings = EXCLUDED.recordings, checked_at = NOW(), cache_version = 2`,
      [dialer, lead_id, JSON.stringify(recordings)]);
      failures.delete(key);
    })().catch(error => {
      failures.set(key, Date.now());
      console.warn('LA recording refresh failed:', error.message);
    }).finally(() => {
      queued.delete(key);
      running--;
      drain();
    });
  }
}

async function getLaDurationData(startDate, endDate, dialer) {
  const dialers = dialer === 'all' ? ['medicare', 'pharmacy'] : [dialer];
  const registries = Object.fromEntries(await Promise.all(dialers.map(async type => [type, await getDialerDids(type)])));
  const params = [startDate, endDate];
  const filter = dialer === 'all' ? '' : ' AND s.dialer = $3';
  if (dialer !== 'all') params.push(dialer);
  // Synthetic repeat-sale suffixes refer to the same dialer lead. Fetch once.
  const { rows } = await query(`SELECT DISTINCT ON (s.dialer, split_part(s.lead_id, '_', 1))
      s.dialer, split_part(s.lead_id, '_', 1) AS lead_id, s.phone, s.agent, s.qa_status,
      c.recordings, c.checked_at, c.cache_version
    FROM dialer_sales_history s LEFT JOIN dashboard_la_recordings c
      ON c.dialer = s.dialer AND c.lead_id = split_part(s.lead_id, '_', 1)
    WHERE s.sale_date BETWEEN $1::date AND $2::date ${filter}
    ORDER BY s.dialer, split_part(s.lead_id, '_', 1), s.sale_date DESC, s.id DESC`, params);
  let pending = 0;
  let failed = 0;
  let known = 0;
  const recordings = [];
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.dialer}:${row.lead_id}`;
    const stale = !row.checked_at || row.cache_version !== 2 || Date.now() - new Date(row.checked_at).getTime() > 15 * 60 * 1000;
    if (stale) {
      if (failures.has(key) && Date.now() - failures.get(key) < 60 * 1000) failed++;
      else {
        pending++;
        if (!queued.has(key)) {
          queued.add(key);
          jobs.push({ dialer: row.dialer, lead_id: row.lead_id, key });
        }
      }
    }
    if (row.checked_at) known++;
    for (const raw of row.recordings || []) {
      const rec = laRecording(raw, registries[row.dialer].presets);
      if (!rec || rec.date.slice(0, 10) < startDate || rec.date.slice(0, 10) > endDate) continue;
      const identity = `${row.dialer}:${rec.recid || rec.location}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      recordings.push({
        ...rec, id: identity, lead_id: row.lead_id, dialer: row.dialer,
        phone: row.phone, agent: rec.tsr || row.agent, qa_status: row.qa_status,
      });
    }
  }
  drain();
  recordings.sort((a, b) => b.call_duration_seconds - a.call_duration_seconds || a.id.localeCompare(b.id));
  const counts = {
    '800': 0, '1000': 0, '1500': 0, pending, failed, known, totalLeads: rows.length,
    didReady: Object.values(registries).every(registry => registry.ready),
    didRefreshing: Object.values(registries).some(registry => registry.refreshing),
    didSyncFailed: Object.values(registries).some(registry => registry.failed),
  };
  for (const rec of recordings) {
    const bucket = durationBucket(rec.call_duration_seconds);
    if (bucket) counts[bucket]++;
  }
  return { counts, recordings };
}

module.exports = { getLaDurationData };
