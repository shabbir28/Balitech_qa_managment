const { query } = require('../config/database');
const { fetchAdminPage } = require('../controllers/dialerController');
const { campaignIds, parsePresets, mergePresets } = require('../utils/dialerPresets');

const REFRESH_MS = 5 * 60 * 1000;
const inFlight = new Map();
const retryAfter = new Map();

async function refreshDialerDids(dialer) {
  if (!['medicare', 'pharmacy'].includes(dialer)) throw new Error('Invalid dialer');
  if (inFlight.has(dialer)) return inFlight.get(dialer);
  const promise = (async () => {
    const ids = campaignIds(await fetchAdminPage('admin.php?ADD=10', dialer));
    const current = {};
    // Publish only a complete snapshot. A single failed page must not retire DIDs.
    for (const id of ids) {
      const presets = parsePresets(await fetchAdminPage(
        `admin.php?ADD=31&SUB=201&campaign_id=${encodeURIComponent(id)}`, dialer));
      for (const [did, name] of Object.entries(presets)) {
        const names = new Set([...(current[did]?.split(' / ') || []), name]);
        current[did] = [...names].sort().join(' / ');
      }
    }
    const previous = await query('SELECT presets FROM dashboard_dialer_presets WHERE dialer = $1', [dialer]);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const presets = mergePresets(previous.rows[0]?.presets, current, today);
    await query(`INSERT INTO dashboard_dialer_presets (dialer, presets, checked_at)
      VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (dialer)
      DO UPDATE SET presets = EXCLUDED.presets, checked_at = NOW()`, [dialer, JSON.stringify(presets)]);
    retryAfter.delete(dialer);
    return { dialer, campaigns: ids.length, activeDids: Object.keys(current).length };
  })();
  inFlight.set(dialer, promise);
  try { return await promise; }
  catch (error) { retryAfter.set(dialer, Date.now() + 60000); throw error; }
  finally { inFlight.delete(dialer); }
}

async function getDialerDids(dialer) {
  const result = await query('SELECT presets, checked_at FROM dashboard_dialer_presets WHERE dialer = $1', [dialer]);
  const saved = result.rows[0];
  const stale = !saved || Date.now() - new Date(saved.checked_at).getTime() >= REFRESH_MS;
  if (stale && !inFlight.has(dialer) && (retryAfter.get(dialer) || 0) <= Date.now()) {
    refreshDialerDids(dialer).catch(error => console.warn(`DID preset refresh (${dialer}):`, error.message));
  }
  return {
    presets: saved?.presets || {}, ready: !!saved,
    refreshing: inFlight.has(dialer), failed: retryAfter.has(dialer),
  };
}

module.exports = { getDialerDids, refreshDialerDids };
