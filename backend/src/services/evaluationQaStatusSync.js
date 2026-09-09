/**
 * evaluationQaStatusSync.js
 * Propagates a QA evaluation's outcome to dialer_sales_history and HRMS.
 *
 * The evaluation form stores the human-facing outcome (Accepted / Rejected /
 * Flagged / Decline / Not Billable) in metadata.qa_status and a legacy
 * Pass / Fail value in qa_evaluations.status. HRMS and the Dialer Sales pages
 * speak the Accepted / Rejected vocabulary, so we normalise before writing.
 */

const { syncDialerTransfersToHRMS, normalizeQaStatus } = require('./hrmsSyncService');

const RETURNING_COLS = 'lead_id, dialer, qa_status, phone, status, agent, team, sale_date';

/**
 * The UI's chosen status lives in metadata.qa_status; qa_evaluations.status
 * may hold a legacy Pass/Fail. Prefer the UI value, then normalise.
 */
function resolveQaStatus(finalStatus, metadata) {
  const fromMeta = metadata && typeof metadata.qa_status === 'string' ? metadata.qa_status.trim() : '';
  const raw = fromMeta || finalStatus || '';
  if (!raw) return '';
  return normalizeQaStatus(raw);
}

function extractDialerLeadId(notes) {
  const m = String(notes || '').match(/(?:Lead ID:\s*|VICI_LEAD:)(\d+)/i);
  return m ? m[1] : null;
}

function detectDialer(call) {
  const txt = `${call.campaign_name || ''} ${call.team || ''}`.toLowerCase();
  return txt.includes('medicare') ? 'medicare' : 'pharmacy';
}

/**
 * Human-readable QA note for HRMS: "<LA error category> — <LA feedback>".
 */
function buildQaNotes(metadata) {
  if (!metadata || typeof metadata !== 'object') return '';
  const category = String(metadata.laSideErrorCategory || '').trim();
  const feedback = String(metadata.laSideFeedback || '').trim();
  return [category, feedback].filter(Boolean).join(' — ').slice(0, 2000);
}

/**
 * Update dialer_sales_history.qa_status for the dialer lead(s) behind a call.
 *
 * Match order: dialer lead id (from call notes) → normalised phone → create a
 * skeleton row so HRMS still receives the status even if the sale was never
 * cached locally.
 *
 * @param {(sql: string, params: any[]) => Promise<{rows: any[]}>} exec  query runner (tx client or pool)
 * @param {Object} call         call_leads row
 * @param {string} finalStatus  qa_evaluations.status value
 * @param {Object} metadata     evaluation metadata (may hold qa_status)
 * @returns {Promise<{qaStatus: string, rows: any[]}>}
 */
async function applyEvaluationQaStatus(exec, call, finalStatus, metadata) {
  const qaStatus = resolveQaStatus(finalStatus, metadata);
  if (!qaStatus) return { qaStatus, rows: [] };

  const leadId = extractDialerLeadId(call.notes);
  const phoneDigits = String(call.customer_phone || '').replace(/\D/g, '');
  let rows = [];

  if (leadId) {
    const res = await exec(
      `UPDATE dialer_sales_history SET qa_status = $1
       WHERE lead_id = $2
       RETURNING ${RETURNING_COLS}`,
      [qaStatus, leadId]
    );
    rows = res.rows;
  }

  if (rows.length === 0 && phoneDigits.length >= 7) {
    // Compare on the last 10 digits so "+1 (555) 123-4567" matches "5551234567".
    const res = await exec(
      `UPDATE dialer_sales_history SET qa_status = $1
       WHERE right(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = right($2, 10)
       RETURNING ${RETURNING_COLS}`,
      [qaStatus, phoneDigits]
    );
    rows = res.rows;
  }

  if (rows.length === 0 && leadId) {
    const res = await exec(
      `INSERT INTO dialer_sales_history (lead_id, dialer, phone, agent, team, status, qa_status, sale_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::date, CURRENT_DATE))
       ON CONFLICT (lead_id, dialer) DO UPDATE SET qa_status = EXCLUDED.qa_status
       RETURNING ${RETURNING_COLS}`,
      [
        leadId,
        detectDialer(call),
        call.customer_phone || null,
        call.agent_name || null,
        call.campaign_name || null,
        call.disposition || null,
        qaStatus,
        call.call_date || null,
      ]
    );
    rows = res.rows;
  }

  // qa_notes is not a dialer_sales_history column; attach it for the HRMS payload only.
  const qaNotes = buildQaNotes(metadata);
  rows = rows.map((r) => ({ ...r, qa_notes: qaNotes }));

  return { qaStatus, rows };
}

/**
 * Fire-and-forget push of updated dialer rows to HRMS. Never throws.
 */
function pushQaStatusToHrms(rows, context = 'evaluation') {
  if (!rows || rows.length === 0) return;
  syncDialerTransfersToHRMS(rows).catch((e) =>
    console.warn(`[HRMS Sync] ${context} qa-status error:`, e.message)
  );
}

module.exports = {
  applyEvaluationQaStatus,
  pushQaStatusToHrms,
  resolveQaStatus,
  extractDialerLeadId,
};
