/**
 * One-time backfill: push every existing QA evaluation's status to
 * dialer_sales_history and HRMS.
 *
 * Why: before the evaluation -> HRMS wiring existed, evaluated leads stayed
 * "Pending" in HRMS. This replays all evaluations through the same code path
 * the live app now uses.
 *
 * Usage (from backend/):
 *   node scripts/backfill_qa_status_to_hrms.js --dry-run          # show what would change, no writes
 *   node scripts/backfill_qa_status_to_hrms.js                    # all evaluations
 *   node scripts/backfill_qa_status_to_hrms.js --days 30          # only last 30 days
 *
 * Requires HRMS_SYNC_URL and HRMS_SYNC_SECRET in .env for the HRMS push.
 */

const { query, pool } = require('../src/config/database');
const { applyEvaluationQaStatus } = require('../src/services/evaluationQaStatusSync');
const { syncDialerTransfersToHRMS, normalizeQaStatus } = require('../src/services/hrmsSyncService');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const daysIdx = args.indexOf('--days');
const DAYS = daysIdx !== -1 ? parseInt(args[daysIdx + 1], 10) : null;
const HRMS_CHUNK = 500;

async function normaliseLegacyStatuses() {
  const res = await query(
    `SELECT qa_status, COUNT(*)::int AS cnt
     FROM dialer_sales_history
     WHERE qa_status IN ('Pass', 'Fail', 'Not Bilable')
     GROUP BY qa_status`
  );
  if (res.rows.length === 0) {
    console.log('No legacy Pass/Fail/Not Bilable values in dialer_sales_history.');
    return;
  }
  console.table(res.rows);
  if (DRY_RUN) return;

  const upd = await query(
    `UPDATE dialer_sales_history SET qa_status = CASE qa_status
        WHEN 'Pass' THEN 'Accepted'
        WHEN 'Fail' THEN 'Rejected'
        WHEN 'Not Bilable' THEN 'Not Billable'
        ELSE qa_status END
     WHERE qa_status IN ('Pass', 'Fail', 'Not Bilable')`
  );
  console.log(`Normalised ${upd.rowCount} legacy dialer_sales_history rows.`);
}

async function replayEvaluations() {
  const params = [];
  let dateFilter = '';
  if (DAYS && DAYS > 0) {
    params.push(DAYS);
    dateFilter = `AND qe.evaluation_date >= CURRENT_DATE - make_interval(days => $1::int)`;
  }

  const evals = await query(
    `SELECT qe.id AS evaluation_id, qe.status, qe.metadata, qe.evaluation_date,
            cl.id AS call_lead_id, cl.notes, cl.customer_phone, cl.campaign_name,
            cl.agent_name, cl.disposition, cl.call_date
     FROM qa_evaluations qe
     JOIN call_leads cl ON cl.id = qe.call_lead_id
     WHERE qe.is_deleted = FALSE ${dateFilter}
     ORDER BY qe.id`,
    params
  );
  console.log(`Found ${evals.rows.length} evaluation(s) to replay${DAYS ? ` (last ${DAYS} days)` : ''}.`);

  const toPush = new Map(); // key lead_id|dialer -> row (latest evaluation wins)
  const summary = {};
  let unmatched = 0;

  for (const ev of evals.rows) {
    const call = {
      id: ev.call_lead_id,
      notes: ev.notes,
      customer_phone: ev.customer_phone,
      campaign_name: ev.campaign_name,
      agent_name: ev.agent_name,
      disposition: ev.disposition,
      call_date: ev.call_date,
    };
    const status = normalizeQaStatus(
      (ev.metadata && ev.metadata.qa_status) || ev.status
    );
    summary[status] = (summary[status] || 0) + 1;

    if (DRY_RUN) continue;

    try {
      const { rows } = await applyEvaluationQaStatus(query, call, ev.status, ev.metadata);
      if (rows.length === 0) {
        unmatched++;
        continue;
      }
      for (const r of rows) toPush.set(`${r.lead_id}|${r.dialer}`, r);
    } catch (err) {
      console.warn(`  eval #${ev.evaluation_id}: ${err.message}`);
    }
  }

  console.log('Status breakdown:');
  console.table(Object.entries(summary).map(([status, count]) => ({ status, count })));

  if (DRY_RUN) {
    console.log('[dry-run] No DB writes, no HRMS calls.');
    return;
  }

  console.log(`Dialer rows updated: ${toPush.size}; evaluations with no dialer match: ${unmatched}`);

  if (!process.env.HRMS_SYNC_URL || !process.env.HRMS_SYNC_SECRET) {
    console.warn('HRMS_SYNC_URL / HRMS_SYNC_SECRET not set — skipping HRMS push. DB is updated.');
    return;
  }

  const rows = [...toPush.values()];
  for (let i = 0; i < rows.length; i += HRMS_CHUNK) {
    const chunk = rows.slice(i, i + HRMS_CHUNK);
    console.log(`Pushing ${chunk.length} record(s) to HRMS (${i + chunk.length}/${rows.length})...`);
    await syncDialerTransfersToHRMS(chunk);
  }
}

(async () => {
  try {
    console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE RUN ===');
    await normaliseLegacyStatuses();
    await replayEvaluations();
    console.log('Done.');
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
