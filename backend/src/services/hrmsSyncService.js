/**
 * hrmsSyncService.js
 * Backend-only service to sync Dialer Sales data to HRMS production.
 * NEVER import or expose HRMS_SYNC_SECRET in frontend / browser code.
 */

const https = require('https');
const http = require('http');

/**
 * Canonical QA statuses understood by HRMS and the Dialer Sales pages.
 * Legacy / misspelt values from older evaluations are folded into these.
 */
const HRMS_QA_STATUSES = ['Pending', 'Accepted', 'Rejected', 'Flagged', 'Decline', 'Not Billable'];

const QA_STATUS_ALIASES = {
  pass: 'Accepted',
  accepted: 'Accepted',
  fail: 'Rejected',
  rejected: 'Rejected',
  flagged: 'Flagged',
  flag: 'Flagged',
  decline: 'Decline',
  declined: 'Decline',
  'not billable': 'Not Billable',
  'not bilable': 'Not Billable',
  notbillable: 'Not Billable',
  pending: 'Pending',
};

/**
 * Normalise any QA status spelling into one of HRMS_QA_STATUSES.
 * Unknown values fall back to Pending so HRMS never receives garbage.
 */
function normalizeQaStatus(value) {
  const key = String(value || '').trim().toLowerCase();
  return QA_STATUS_ALIASES[key] || 'Pending';
}

/**
 * Map a QA dialer_sales_history row to the HRMS expected format.
 * @param {Object} row
 * @returns {Object}
 */
function mapRowToHrms(row) {
  return {
    lead_id:          row.lead_id   || row.leadId || row.id || null,
    status:           row.disposition || row.status || null,
    qa_status:        normalizeQaStatus(row.qa_status || row.qaStatus),
    // Empty string tells HRMS "no new note" so it keeps whatever it already has.
    qa_notes:         row.qa_notes || row.qaNotes || '',
    phone_number:     row.phone_number || row.phone  || row.phoneNumber || null,
    customer_name:    row.customer_name || row.customerName || row.name || null,
    team:             row.team || row.campaign || '',
    // agent name must include code in parentheses e.g. "Muhammad Shabbir (5053)"
    dialer_agent_name: row.agent || row.agent_name || row.agentName || row.last_agent || null,
    last_call_at:     row.last_call || row.lastCall || row.last_call_at || row.created_at || new Date().toISOString(),
  };
}

/**
 * POST records to HRMS sync endpoint.
 * Non-fatal: logs warning on failure, never throws to caller.
 *
 * @param {Array} records  - Array of dialer_sales_history rows (or pre-mapped objects)
 * @param {boolean} alreadyMapped - If true, records are already in HRMS format
 */
async function syncDialerTransfersToHRMS(records, alreadyMapped = false) {
  if (!records || records.length === 0) return;

  const url  = process.env.HRMS_SYNC_URL;
  const secret = process.env.HRMS_SYNC_SECRET;

  if (!url || !secret) {
    console.warn('[HRMS Sync] HRMS_SYNC_URL or HRMS_SYNC_SECRET not configured in .env — skipping sync.');
    return;
  }

  // Even pre-mapped payloads get their qa_status normalised so every caller
  // speaks the same vocabulary to HRMS.
  const mapped = alreadyMapped
    ? records.map((r) => ({ ...r, qa_status: normalizeQaStatus(r.qa_status) }))
    : records.map(mapRowToHrms);

  const payload = JSON.stringify({ secret, records: mapped });

  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const lib    = urlObj.protocol === 'https:' ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path:     urlObj.pathname + urlObj.search,
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 10000, // 10 sec timeout
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.success) {
              console.log(`[HRMS Sync] ✅ Synced ${mapped.length} record(s) — inserted:${json.inserted} updated:${json.updated}`);
            } else {
              console.warn('[HRMS Sync] ⚠️ HRMS responded with failure:', json);
            }
          } catch {
            console.warn('[HRMS Sync] ⚠️ Non-JSON response from HRMS:', data.substring(0, 200));
          }
          resolve();
        });
      });

      req.on('timeout', () => {
        console.warn('[HRMS Sync] ⚠️ Request timed out — aborting sync.');
        req.destroy();
        resolve();
      });

      req.on('error', (err) => {
        console.warn('[HRMS Sync] ⚠️ Request error:', err.message);
        resolve();
      });

      req.write(payload);
      req.end();
    } catch (err) {
      console.warn('[HRMS Sync] ⚠️ Unexpected error:', err.message);
      resolve();
    }
  });
}

module.exports = { syncDialerTransfersToHRMS, mapRowToHrms, normalizeQaStatus, HRMS_QA_STATUSES };
