const { fetchAdminPage, extractLeadsFromHtml } = require('./dialerController');
const { query } = require('../config/database');
const { syncDialerTransfersToHRMS, mapRowToHrms } = require('../services/hrmsSyncService');
// Memory cache for statuses
const saleStatusesCache = {
  pharmacy: { statuses: null, lastFetched: 0 },
  medicare: { statuses: null, lastFetched: 0 }
};

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Helpers
async function getSaleStatuses(dialerType) {
  const now = Date.now();
  if (saleStatusesCache[dialerType].statuses && (now - saleStatusesCache[dialerType].lastFetched < CACHE_TTL)) {
    return saleStatusesCache[dialerType].statuses;
  }

  const statuses = new Set();

  try {
    // 1. Fetch system statuses
    const sysHtml = await fetchAdminPage('admin.php?ADD=321111111111111', dialerType);
    parseStatusesHtml(sysHtml, statuses);

    // 2. Fetch campaigns list
    const campHtml = await fetchAdminPage('admin.php?ADD=10', dialerType);
    const campRows = campHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    const campaigns = new Set();
    if (campRows) {
      for (const row of campRows) {
        // e.g. admin.php?ADD=31&campaign_id=001
        if (row.includes('campaign_id=')) {
          const match = row.match(/campaign_id=([^"'>&\s]+)/);
          if (match) campaigns.add(match[1]);
        }
      }
    }

    // 3. Fetch each campaign's statuses
    for (const campaignId of campaigns) {
      try {
        const cStatHtml = await fetchAdminPage(`admin.php?ADD=34&campaign_id=${campaignId}&custom_report_1=1`, dialerType);
        parseStatusesHtml(cStatHtml, statuses);
      } catch (err) {
        console.error(`Failed to fetch statuses for campaign ${campaignId} on ${dialerType}`);
      }
    }

    const result = [...statuses];
    // Only cache if we found statuses
    if (result.length > 0) {
      saleStatusesCache[dialerType] = {
        statuses: result,
        lastFetched: now
      };
    }
    return result;

  } catch (error) {
    console.error('Error in getSaleStatuses:', error);
    // fallback if error and we have cache
    if (saleStatusesCache[dialerType].statuses) {
      return saleStatusesCache[dialerType].statuses;
    }
    // minimal default if error and no cache
    return []; 
  }
}

function parseStatusesHtml(html, statusSet) {
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows) return;
  for (const row of rows) {
    // Look for a status row. Status rows in Vicidial often contain a hidden input for status or ADD=42 / ADD=4.
    const statusMatch = row.match(/name=status\s+value=["']([^"']+)["']/i) || row.match(/status=([^"'>&\s]+)/i);
    
    if (statusMatch) {
      const status = statusMatch[1];
      const cols = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      
      // Usually Sale is at column 5 for campaign custom statuses
      if (cols && cols.length >= 6) {
        let isSale = false;
        
        // System statuses vs Campaign statuses:
        // Let's check both cols[4] and cols[5] just to be safe, since System statuses might not have Human Answer.
        // Also, the value is inside a <select> with <option value='Y' selected>
        const getSelectedVal = (tdHtml) => {
          const match = tdHtml.match(/<option[^>]*value=['"]([^'"]+)['"][^>]*selected/i);
          if (match) return match[1].toUpperCase();
          // Fallback if no selected explicit attribute:
          if (tdHtml.includes(">Y<")) return 'Y'; 
          const cleanStr = tdHtml.replace(/<[^>]*>/g, '').trim();
          return cleanStr;
        };

        const val4 = getSelectedVal(cols[4]);
        const val5 = getSelectedVal(cols[5]);
        
        if (val4 === 'Y' || val5 === 'Y') {
          // Verify it's actually the SALE column by checking if one of them is the sale dropdown.
          // In campaign statuses, cols[5] is Sale. In System statuses, cols[4] is Sale.
          // Wait, if BOTH can be Y (e.g. Human Answer = Y, Sale = Y), we must ensure we are checking the actual Sale column.
          // We can just rely on the name='sale' attribute in the select!
          const saleSelectMatch = row.match(/name=["']?sale["']?[\s\S]*?<\/select>/i);
          if (saleSelectMatch) {
            const saleVal = getSelectedVal(saleSelectMatch[0]);
            if (saleVal === 'Y') {
              isSale = true;
            }
          } else {
             // Fallback for simple text tables without <select>
             if (val4 === 'Y' || val5 === 'Y') isSale = true;
          }
        }

        if (isSale && status) {
          statusSet.add(status);
        }
      }
    }
  }
}

exports.getSales = async (req, res) => {
  try {
    const dialerType = req.query.dialer;
    const timeFilter = req.query.timeFilter || 'TODAY'; // 'TODAY' or 'MONTH'

    if (!['pharmacy', 'medicare'].includes(dialerType)) {
      return res.status(400).json({ success: false, message: 'Invalid dialer type' });
    }

    // Format date in US Eastern Time (Vicidial timezone)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const now = new Date();
    const todayStr = formatter.format(now);
    
    let queryDateStr = todayStr;
    const endDateStr = todayStr;

    if (timeFilter === 'MONTH') {
      // Get the 1st of the current month in the Vicidial timezone
      // We can create a new Date for the 1st of the current month
      const parts = formatter.formatToParts(now);
      const year = parts.find(p => p.type === 'year').value;
      const month = parts.find(p => p.type === 'month').value;
      queryDateStr = `${year}-${month}-01`;
    }

    // 1. Determine active statuses
    let statuses = await getSaleStatuses(dialerType);

    // Force include specific statuses for Medicare even if not marked as Sale=Y in Vicidial
    if (dialerType === 'medicare') {
      const forceStatuses = ['D2', 'D3'];
      forceStatuses.forEach(s => {
        if (!statuses.includes(s)) statuses.push(s);
      });
    }

    // Ensure array unique
    statuses = [...new Set(statuses)];

    let allLeads = [];

    // -- PHARMACY FALLBACK: Use admin_search_lead.php --
    if (dialerType === 'pharmacy') {
      for (const status of statuses) {
        const body = new URLSearchParams({
          status: status,
          SUBMIT: 'SUBMIT'
        }).toString();

        try {
          const html = await fetchAdminPage('admin_search_lead.php', dialerType, 'POST', body);
          const leads = extractLeadsFromHtml(html);
          // Filter by date range for pharmacy (admin_search_lead.php returns all dates)
          const filtered = leads.filter(l => {
            if (!l.last_call || l.last_call.length < 10) return false;
            const d = l.last_call.substring(0, 10);
            return d >= queryDateStr && d <= endDateStr;
          });
          allLeads = [...allLeads, ...filtered];
        } catch (err) {
          console.error(`Error fetching status ${status} on ${dialerType}:`, err.message);
        }
      }
    } 
    // -- MEDICARE PREFERRED: Use call_report_export.php for accurate daily data --
    else {
      // Export report takes multiple status[] parameters
      const params = new URLSearchParams();
      params.append('run_export', '1');
      params.append('query_date', queryDateStr);
      params.append('end_date', endDateStr);
      params.append('campaign[]', '--ALL--');
      params.append('group[]', '--ALL--');
      params.append('header_row', 'Y');
      params.append('rec_fields', 'N');
      params.append('export_fields', 'STANDARD');
      params.append('SUBMIT', 'SUBMIT');

      statuses.forEach(s => params.append('status[]', s));

      try {
        const tsvData = await fetchAdminPage('call_report_export.php', dialerType, 'POST', params.toString());
        
        // Check if permissions denied
        if (tsvData.includes('You do not have permissions for export reports')) {
          console.error('Export permissions missing for', dialerType);
        } else {
          const lines = tsvData.split('\n'); // Standard newline split works best for TSV
          for (const line of lines) {
            const cols = line.split('\t');
            // If row has at least 10 columns and starts with a date
            if (cols.length >= 10 && cols[0] && cols[0].trim().startsWith('20')) {
              const parsedLeadId = cols.length > 35 ? (cols[35] ? cols[35].trim() : '') : (cols[cols.length - 1] ? cols[cols.length - 1].trim() : '');
              allLeads.push({
                last_call: cols[0].trim(),
                phone: cols[1] ? cols[1].trim() : '',
                status: cols[2] ? cols[2].trim() : '',
                last_agent: (cols[4] ? cols[4].trim() : '') + (cols[3] && cols[3].trim() ? ` (${cols[3].trim()})` : ''), // Agent Name (col 4) + ID (col 3)
                team: cols.length > 31 ? (cols[31] ? cols[31].trim() : '') : '', // User Group / Team
                name: cols.length > 13 ? (cols[13] ? cols[13].trim() : '') : '', // First Name
                lead_id: parsedLeadId
              });
            }
          }
        }
      } catch (err) {
        console.error(`Error exporting data for ${dialerType}:`, err.message);
      }
    }

    // Deduplicate leads just in case
    const uniqueMap = new Map();
    allLeads.forEach(l => {
      if (l.lead_id) {
        uniqueMap.set(l.lead_id, l);
      } else {
        // Fallback for leads without lead_id so they don't overwrite each other
        uniqueMap.set(`${l.phone}_${l.last_call}`, l);
      }
    });
    const uniqueLeads = Array.from(uniqueMap.values());

    // Sort by last call time desc
    uniqueLeads.sort((a, b) => new Date(b.last_call) - new Date(a.last_call));

    // BACKGROUND SYNC: Save all fetched sales into dialer_sales_history
    if (uniqueLeads.length > 0) {
      try {
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < uniqueLeads.length; i += CHUNK_SIZE) {
          const chunk = uniqueLeads.slice(i, i + CHUNK_SIZE);
          const values = [];
          const placeholders = [];
          
          chunk.forEach((l, index) => {
            const p = index * 7;
            placeholders.push(`($${p+1}, $${p+2}, $${p+3}, $${p+4}, $${p+5}, $${p+6}, $${p+7})`);
            
            let saleDate = queryDateStr;
            if (l.last_call && l.last_call.length >= 10) {
              saleDate = l.last_call.substring(0, 10);
            }
            
            values.push(
              l.lead_id,
              l.phone || null,
              l.status || null,
              l.last_agent || null,
              saleDate,
              dialerType,
              l.team || null
            );
          });

          const sql = `
            INSERT INTO dialer_sales_history (lead_id, phone, status, agent, sale_date, dialer, team)
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (lead_id, dialer) DO UPDATE SET 
              status = EXCLUDED.status,
              agent = EXCLUDED.agent,
              sale_date = EXCLUDED.sale_date,
              team = EXCLUDED.team
          `;
          
          // Fire and forget chunks — also sync to HRMS after each successful insert
          query(sql, values).then(() => {
            // Map chunk to HRMS format and sync (non-blocking, non-fatal)
            const hrmsRecords = chunk.map(l => ({
              lead_id:           l.lead_id,
              status:            l.status,
              qa_status:         'Pending',
              phone_number:      l.phone,
              customer_name:     l.name || null,
              team:              l.team || '',
              dialer_agent_name: l.last_agent || l.agent || null,
              last_call_at:      l.last_call || new Date().toISOString(),
            }));
            syncDialerTransfersToHRMS(hrmsRecords, true).catch(e => console.warn('[HRMS Sync] fire-and-forget error:', e.message));
          }).catch(e => console.error('Bulk insert chunk error:', e.message));
        }
      } catch (syncErr) {
        console.error('Error preparing bulk insert for dialer_sales_history:', syncErr);
      }
    }

    res.json({
      success: true,
      data: uniqueLeads,
      statuses: statuses
    });

  } catch (error) {
    console.error('Dialer Sales Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.syncStatuses = async (req, res) => {
  try {
    const { dialer = 'pharmacy' } = req.body;
    if (!saleStatusesCache[dialer]) {
      return res.status(400).json({ success: false, message: "Invalid dialer. Must be 'pharmacy' or 'medicare'." });
    }
    // Force cache expiry
    saleStatusesCache[dialer].lastFetched = 0;
    const statuses = await getSaleStatuses(dialer);
    res.json({ success: true, message: 'Statuses synced successfully', statuses });
  } catch (error) {
    console.error('Error syncing statuses:', error);
    res.status(500).json({ success: false, message: 'Failed to sync statuses' });
  }
};

exports.compareSales = async (req, res) => {
  try {
    const { dialer, startDate, endDate, date, phones } = req.body;
    if (!dialer || (!date && (!startDate || !endDate)) || !Array.isArray(phones)) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const start = startDate || date;
    const end   = endDate   || date;

    // Normalize phones (keep only digits, usually last 10)
    const cleanPhones = phones.map(p => {
      const digits = String(p).replace(/\D/g, '');
      return digits.length > 10 ? digits.slice(-10) : digits;
    }).filter(p => p.length >= 10);

    if (cleanPhones.length === 0) {
       return res.json({ success: true, data: [] });
    }

    const { query } = require('../config/database');
    const result = await query(
      `SELECT lead_id, phone, status, agent, team, sale_date 
       FROM dialer_sales_history 
       WHERE dialer = $1 AND sale_date >= $2 AND sale_date <= $3 AND phone = ANY($4::varchar[])`,
      [dialer, start, end, cleanPhones]
    );

    return res.json({
      success: true,
      data: result.rows,
      summary: {
        total_uploaded: cleanPhones.length,
        total_found: result.rows.length
      }
    });
  } catch (error) {
    console.error('Error in compareSales:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /dialer-sales/backfill  { dialer, startDate, endDate }
// Fetches historical data from the dialer for a given date range and saves to DB
exports.backfillSales = async (req, res) => {
  try {
    const { dialer, startDate, endDate } = req.body;

    if (!['pharmacy', 'medicare'].includes(dialer)) {
      return res.status(400).json({ success: false, message: 'Invalid dialer type' });
    }

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!startDate || !dateRe.test(startDate) || !endDate || !dateRe.test(endDate)) {
      return res.status(400).json({ success: false, message: 'Invalid dates. Use YYYY-MM-DD format.' });
    }

    if (startDate > endDate) {
      return res.status(400).json({ success: false, message: 'startDate cannot be after endDate' });
    }

    console.log(`[Backfill] Starting: ${dialer} | ${startDate} → ${endDate}`);

    // 1. Get sale statuses
    let statuses = await getSaleStatuses(dialer);
    if (dialer === 'medicare') {
      ['D2', 'D3', 'HIMAIN'].forEach(s => { if (!statuses.includes(s)) statuses.push(s); });
    }
    statuses = [...new Set(statuses)];
    console.log(`[Backfill] Statuses (${statuses.length}):`, statuses);

    // If still empty, use hardcoded fallback for medicare
    if (statuses.length === 0 && dialer === 'medicare') {
      statuses = ['D2', 'D3', 'D4', 'D5', 'DSB', 'D1', 'HIB', 'HIMAIN'];
      console.log('[Backfill] Using hardcoded fallback statuses for medicare');
    }

    let allLeads = [];

    // 2. Fetch from dialer
    if (dialer === 'pharmacy') {
      // Pharmacy: admin_search_lead.php doesn't support date range — fetch all then filter by date
      for (const status of statuses) {
        const body = new URLSearchParams({ status, SUBMIT: 'SUBMIT' }).toString();
        try {
          const html = await fetchAdminPage('admin_search_lead.php', dialer, 'POST', body);
          const leads = extractLeadsFromHtml(html);
          // Filter by date range
          const filtered = leads.filter(l => {
            if (!l.last_call || l.last_call.length < 10) return false;
            const d = l.last_call.substring(0, 10);
            return d >= startDate && d <= endDate;
          });
          allLeads = [...allLeads, ...filtered];
        } catch (err) {
          console.error(`[Backfill] Error fetching status ${status}:`, err.message);
        }
      }
    } else {
      // Medicare: call_report_export.php REQUIRES end_date = today to return data.
      // We fetch from startDate → today, then filter records by sale_date <= endDate.
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
      const todayStr = formatter.format(new Date());

      const params = new URLSearchParams();
      params.append('run_export', '1');
      params.append('query_date', startDate);   // user's start date
      params.append('end_date',   todayStr);    // MUST be today — Vicidial limitation
      params.append('campaign[]', '--ALL--');
      params.append('group[]', '--ALL--');
      params.append('header_row', 'Y');
      params.append('rec_fields', 'N');
      params.append('export_fields', 'STANDARD');
      params.append('SUBMIT', 'SUBMIT');
      statuses.forEach(s => params.append('status[]', s));
      console.log(`[Backfill] Fetching Medicare: query_date=${startDate} end_date=${todayStr} (today, required by Vicidial)`);

      try {
        const tsvData = await fetchAdminPage('call_report_export.php', dialer, 'POST', params.toString());
        console.log(`[Backfill] TSV response length: ${tsvData.length} chars`);
        console.log(`[Backfill] TSV first 300 chars: ${tsvData.substring(0, 300)}`);
        
        if (tsvData.includes('You do not have permissions for export reports')) {
          return res.status(403).json({ success: false, message: 'Dialer: insufficient export permissions' });
        }
        const lines = tsvData.split('\n');
        console.log(`[Backfill] Total TSV lines: ${lines.length}`);
        let skippedLines = 0;
        for (const line of lines) {
          const cols = line.split('\t');
          if (cols.length >= 10 && cols[0] && cols[0].trim().startsWith('20')) {
            const saleDate = cols[0].trim().substring(0, 10);
            // Filter: only keep records within the user's requested date range
            if (saleDate < startDate || saleDate > endDate) {
              skippedLines++;
              continue;
            }
            const lead = {
              last_call:  cols[0].trim(),
              phone:      cols[1] ? cols[1].trim() : '',
              status:     cols[2] ? cols[2].trim() : '',
              last_agent: cols[4] ? cols[4].trim() : '',
              team:       cols.length > 31 ? (cols[31] ? cols[31].trim() : '') : '',
              lead_id:    cols.length > 35 ? (cols[35] ? cols[35].trim() : '') : (cols[cols.length - 1] ? cols[cols.length - 1].trim() : '')
            };
            if (lead.lead_id) {
              allLeads.push(lead);
            } else {
              skippedLines++;
            }
          } else if (line.trim()) {
            skippedLines++;
          }
        }
        console.log(`[Backfill] Parsed: ${allLeads.length} leads in range, skipped: ${skippedLines} lines`);
      } catch (err) {
        console.error('[Backfill] Export error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch data from dialer' });
      }
    }

    // 3. Deduplicate
    const uniqueMap = new Map();
    allLeads.forEach(l => { if (l.lead_id) uniqueMap.set(l.lead_id, l); });
    const uniqueLeads = Array.from(uniqueMap.values());

    console.log(`[Backfill] Fetched ${uniqueLeads.length} unique leads from dialer`);

    if (uniqueLeads.length === 0) {
      return res.json({ success: true, message: 'No data found in dialer for this date range', saved: 0 });
    }

    // 4. Bulk upsert into DB
    const CHUNK_SIZE = 500;
    let totalSaved = 0;

    for (let i = 0; i < uniqueLeads.length; i += CHUNK_SIZE) {
      const chunk = uniqueLeads.slice(i, i + CHUNK_SIZE);
      const values = [];
      const placeholders = [];

      chunk.forEach((l, index) => {
        const p = index * 7;
        placeholders.push(`($${p+1}, $${p+2}, $${p+3}, $${p+4}, $${p+5}, $${p+6}, $${p+7})`);
        let saleDate = startDate;
        if (l.last_call && l.last_call.length >= 10) {
          saleDate = l.last_call.substring(0, 10);
        }
        values.push(l.lead_id, l.phone || null, l.status || null, l.last_agent || null, saleDate, dialer, l.team || null);
      });

      const sql = `
        INSERT INTO dialer_sales_history (lead_id, phone, status, agent, sale_date, dialer, team)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (lead_id, dialer) DO UPDATE SET
          status    = EXCLUDED.status,
          agent     = EXCLUDED.agent,
          sale_date = EXCLUDED.sale_date,
          team      = EXCLUDED.team
      `;

      try {
        const result = await query(sql, values);
        totalSaved += result.rowCount;
      } catch (e) {
        console.error('[Backfill] Chunk insert error:', e.message);
      }
    }

    console.log(`[Backfill] Done. Saved/updated ${totalSaved} rows.`);
    return res.json({
      success: true,
      message: `Backfill complete`,
      fetched: uniqueLeads.length,
      saved: totalSaved,
      dialer,
      startDate,
      endDate
    });

  } catch (error) {
    console.error('[Backfill] Unexpected error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /dialer-sales/history?dialer=medicare&startDate=2026-08-01&endDate=2026-08-13
exports.getHistorySales = async (req, res) => {
  try {
    const { dialer, startDate, endDate, date } = req.query;

    if (!['pharmacy', 'medicare'].includes(dialer)) {
      return res.status(400).json({ success: false, message: 'Invalid dialer type' });
    }

    // Support both legacy ?date= and new ?startDate=&endDate=
    const start = startDate || date;
    const end   = endDate   || date;

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!start || !dateRe.test(start) || !end || !dateRe.test(end)) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const result = await query(
      `SELECT lead_id, phone, status, agent, team, sale_date, qa_override, qa_status
       FROM dialer_sales_history
       WHERE dialer = $1 AND sale_date >= $2 AND sale_date <= $3
       ORDER BY sale_date DESC, lead_id DESC`,
      [dialer, start, end]
    );

    // Group by status / team for summary
    const statusSummary = {};
    const teamSummary   = {};
    let notASaleCount   = 0;

    result.rows.forEach(row => {
      statusSummary[row.status] = (statusSummary[row.status] || 0) + 1;
      const team = row.team || 'Unknown';
      teamSummary[team] = (teamSummary[team] || 0) + 1;
      if (row.qa_override === 'NOT_A_SALE') notASaleCount++;
    });

    return res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      statusSummary,
      teamSummary,
      notASaleCount,
      startDate: start,
      endDate: end,
      dialer
    });
  } catch (error) {
    console.error('Error in getHistorySales:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /dialer-sales/override  { lead_id, dialer, qa_override }
exports.setQaOverride = async (req, res) => {
  try {
    const { lead_id, dialer, qa_override } = req.body;

    if (!lead_id || !dialer) {
      return res.status(400).json({ success: false, message: 'lead_id and dialer are required' });
    }

    if (!['pharmacy', 'medicare'].includes(dialer)) {
      return res.status(400).json({ success: false, message: 'Invalid dialer type' });
    }

    // qa_override can be null (reset), 'NOT_A_SALE', or any valid status string
    if (qa_override !== null && typeof qa_override !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid qa_override value' });
    }

    const result = await query(
      `UPDATE dialer_sales_history
       SET qa_override = $3
       WHERE lead_id = $1 AND dialer = $2
       RETURNING lead_id, dialer, qa_override, qa_status`,
      [lead_id, dialer, qa_override]
    );

    if (result.rowCount === 0) {
      // If it doesn't exist yet, we will insert a skeletal record so they can override it.
      // This is a safety fallback for live sales not yet saved.
      const insResult = await query(
        `INSERT INTO dialer_sales_history (lead_id, dialer, qa_override, qa_status, sale_date)
         VALUES ($1, $2, $3, 'Pending', CURRENT_DATE)
         RETURNING lead_id, dialer, qa_override, qa_status`,
        [lead_id, dialer, qa_override]
      );
      return res.json({ success: true, data: insResult.rows[0] });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error in setQaOverride:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /dialer-sales/qa-status { lead_id, dialer, qa_status }
exports.setQaStatus = async (req, res) => {
  try {
    const { lead_id, dialer, qa_status } = req.body;

    if (!lead_id || !dialer) {
      return res.status(400).json({ success: false, message: 'lead_id and dialer are required' });
    }

    if (!['pharmacy', 'medicare'].includes(dialer)) {
      return res.status(400).json({ success: false, message: 'Invalid dialer type' });
    }

    const validStatuses = ['Pending', 'Accepted', 'Rejected', 'Flagged'];
    if (!validStatuses.includes(qa_status)) {
      return res.status(400).json({ success: false, message: 'Invalid qa_status value' });
    }

    const result = await query(
      `UPDATE dialer_sales_history
       SET qa_status = $3
       WHERE lead_id = $1 AND dialer = $2
       RETURNING lead_id, dialer, qa_override, qa_status, phone, status, agent, team, sale_date`,
      [lead_id, dialer, qa_status]
    );

    if (result.rowCount === 0) {
      // Create skeleton record
      const insResult = await query(
        `INSERT INTO dialer_sales_history (lead_id, dialer, qa_status, sale_date)
         VALUES ($1, $2, $3, CURRENT_DATE)
         RETURNING lead_id, dialer, qa_override, qa_status, phone, status, agent, team, sale_date`,
        [lead_id, dialer, qa_status]
      );
      // Sync skeleton record to HRMS (non-fatal)
      const skelRow = insResult.rows[0];
      syncDialerTransfersToHRMS([skelRow]).catch(e => console.warn('[HRMS Sync] qa-status skeleton error:', e.message));
      return res.json({ success: true, data: { lead_id: skelRow.lead_id, dialer: skelRow.dialer, qa_override: skelRow.qa_override, qa_status: skelRow.qa_status } });
    }

    // Sync updated record to HRMS (non-fatal, fire-and-forget)
    const updatedRow = result.rows[0];
    syncDialerTransfersToHRMS([updatedRow]).catch(e => console.warn('[HRMS Sync] qa-status update error:', e.message));

    return res.json({ success: true, data: { lead_id: updatedRow.lead_id, dialer: updatedRow.dialer, qa_override: updatedRow.qa_override, qa_status: updatedRow.qa_status } });
  } catch (error) {
    console.error('Error in setQaStatus:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /dialer-sales/overrides-by-leads  { dialer, lead_ids: [] }
exports.getOverridesForLeads = async (req, res) => {
  try {
    const { dialer, lead_ids } = req.body;

    if (!dialer || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const result = await query(
      `SELECT lead_id, qa_override, qa_status
       FROM dialer_sales_history
       WHERE dialer = $1 AND lead_id = ANY($2::varchar[])`,
      [dialer, lead_ids]
    );

    // Return as a map: { lead_id -> { qa_override, qa_status } }
    const map = {};
    result.rows.forEach(r => {
      map[r.lead_id] = {
        qa_override: r.qa_override,
        qa_status: r.qa_status || 'Pending'
      };
    });

    return res.json({ success: true, data: map });
  } catch (error) {
    console.error('Error in getOverridesForLeads:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /dialer-sales/assign { dialer, assigned_to, leads: [], notes }
exports.assignSales = async (req, res) => {
  try {
    const { dialer, assigned_to, leads, notes } = req.body;

    if (!dialer || !assigned_to || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required parameters (dialer, assigned_to, leads)' });
    }

    // Verify campaign
    const campaignName = dialer === 'medicare' ? 'Medicare' : 'Pharmacy';
    let campRes = await query('SELECT id FROM campaigns WHERE name = $1 LIMIT 1', [campaignName]);
    let campaignId = null;
    if (campRes.rows[0]) {
      campaignId = campRes.rows[0].id;
    } else {
      const insCamp = await query('INSERT INTO campaigns (name, description) VALUES ($1, $2) RETURNING id', [campaignName, `${campaignName} auto-generated campaign`]);
      campaignId = insCamp.rows[0].id;
    }

    const assignedCount = [];

    for (const lead of leads) {
      // Check if call_leads already exists for this phone and campaign
      let leadCheck = await query('SELECT id FROM call_leads WHERE customer_phone = $1 AND campaign_id = $2 LIMIT 1', [lead.phone, campaignId]);
      let callLeadId = null;

      if (leadCheck.rows[0]) {
        callLeadId = leadCheck.rows[0].id;
      } else {
        const insLead = await query(
          `INSERT INTO call_leads (agent_name, agent_id, campaign_name, campaign_id, customer_name, customer_phone, call_date, disposition, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            lead.agent || lead.last_agent || 'Dialer Agent',
            lead.agent || lead.last_agent || 'DIALER',
            campaignName,
            campaignId,
            lead.name || '',
            lead.phone,
            lead.sale_date || new Date(),
            lead.status || 'Sale',
            `Assigned from Dialer Sales page. Lead ID: ${lead.lead_id}`
          ]
        );
        callLeadId = insLead.rows[0].id;
      }

      // Assign to user
      let assignCheck = await query('SELECT id FROM lead_assignments WHERE call_lead_id = $1 AND assigned_to = $2 LIMIT 1', [callLeadId, assigned_to]);
      if (!assignCheck.rows[0]) {
        const r = await query(
          `INSERT INTO lead_assignments (call_lead_id, assigned_to, assigned_by, campaign_name, notes)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [callLeadId, assigned_to, req.user.id, campaignName, notes || '']
        );
        if (r.rows[0]) {
          assignedCount.push(r.rows[0].id);
        }
      }
    }

    return res.json({
      success: true,
      message: `${assignedCount.length} lead(s) successfully assigned to QA Agent.`,
      assigned_count: assignedCount.length
    });
  } catch (error) {
    console.error('Error in assignSales:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /dialer-sales/compare-history
// Save comparison results
exports.saveCompareHistory = async (req, res) => {
  try {
    const { file_name, dialer_type, compare_date, total_uploaded, total_found, not_found, uploaded_data, result_data } = req.body;
    
    if (!file_name || !dialer_type || !compare_date || !Array.isArray(uploaded_data) || !Array.isArray(result_data)) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const { query } = require('../config/database');
    const result = await query(
      `INSERT INTO compare_history 
        (user_id, file_name, dialer_type, compare_date, total_uploaded, total_found, not_found, uploaded_data, result_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        req.user ? req.user.id : null,
        file_name,
        dialer_type,
        compare_date,
        total_uploaded,
        total_found,
        not_found,
        JSON.stringify(uploaded_data),
        JSON.stringify(result_data)
      ]
    );

    res.json({ success: true, message: 'Compare history saved', data: result.rows[0] });
  } catch (error) {
    console.error('Error in saveCompareHistory:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /dialer-sales/compare-history
// Fetch history of comparisons for a given date range
exports.getCompareHistory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const { query } = require('../config/database');
    const result = await query(
      `SELECT id, user_id, file_name, dialer_type, compare_date, total_uploaded, total_found, not_found, created_at, uploaded_data, result_data
       FROM compare_history
       WHERE compare_date >= $1 AND compare_date <= $2
       ORDER BY created_at DESC`,
      [startDate, endDate]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error in getCompareHistory:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
// POST /dialer-sales/compare-history/:id/preview-recheck
// Previews missing numbers against a new date range without modifying DB
exports.previewRecheckCompareHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.body;

    if (!id || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'id, startDate, and endDate are required' });
    }

    const { query } = require('../config/database');
    
    // 1. Fetch the source history record
    const recordResult = await query(`SELECT * FROM compare_history WHERE id = $1`, [id]);
    if (recordResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    const record = recordResult.rows[0];
    const dialerType = record.dialer_type;
    let resultData = typeof record.result_data === 'string' ? JSON.parse(record.result_data) : record.result_data;

    // Cap the search endDate to the file's compare_date so we never match future sales
    const compareDateStr = record.compare_date instanceof Date 
      ? record.compare_date.toISOString().split('T')[0] 
      : String(record.compare_date).split('T')[0];
    const maxEndDate = endDate > compareDateStr ? compareDateStr : endDate;

    // 2. Identify missing numbers
    const missingPhones = resultData.filter(d => d.status === 'Not Found').map(d => d.phone);
    if (missingPhones.length === 0) {
      return res.json({ success: true, message: 'No missing numbers to recheck', data: { foundCount: 0, byDate: {} } });
    }

    // 3. Query dialer_sales_history for these phones in the new date range
    const placeholders = missingPhones.map((_, i) => `$${i + 4}`).join(',');
    const findSql = `
      SELECT phone, status, agent, team, sale_date
      FROM dialer_sales_history
      WHERE dialer = $1 
        AND sale_date >= $2 
        AND sale_date <= $3
        AND phone IN (${placeholders})
    `;
    const findValues = [dialerType, startDate, maxEndDate, ...missingPhones];
    const foundResult = await query(findSql, findValues);

    if (foundResult.rowCount === 0) {
      return res.json({ success: true, message: 'No new numbers found', data: { foundCount: 0, byDate: {} } });
    }

    // 4. Group found numbers by sale_date
    const foundByDate = {};
    const allFoundPhones = new Set();
    
    foundResult.rows.forEach(r => {
      // Prioritize preserving team info
      if (!allFoundPhones.has(r.phone) || (r.team && r.team !== '-')) {
         allFoundPhones.add(r.phone);
         
         const dateStr = r.sale_date instanceof Date ? r.sale_date.toISOString().split('T')[0] : String(r.sale_date).split('T')[0];
         
         if (!foundByDate[dateStr]) {
           foundByDate[dateStr] = [];
         }
         
         // Remove if it already exists for this date to avoid duplicates
         foundByDate[dateStr] = foundByDate[dateStr].filter(item => item.phone !== r.phone);
         
         foundByDate[dateStr].push({
           phone: r.phone,
           status: r.status,
           agent: r.agent || '-',
           team: r.team || '-'
         });
      }
    });

    const totalFoundCount = allFoundPhones.size;

    res.json({ 
      success: true, 
      message: `Found ${totalFoundCount} numbers!`, 
      data: { foundCount: totalFoundCount, byDate: foundByDate } 
    });

  } catch (error) {
    console.error('Error in previewRecheckCompareHistory:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /dialer-sales/compare-history/:id/recheck
// Recheck missing numbers against a new date range, moving found ones to target date records
exports.recheckCompareHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.body;

    if (!id || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'id, startDate, and endDate are required' });
    }

    const { query } = require('../config/database');
    
    // 1. Fetch the source history record
    const recordResult = await query(`SELECT * FROM compare_history WHERE id = $1`, [id]);
    if (recordResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    const record = recordResult.rows[0];
    const dialerType = record.dialer_type;
    let resultData = typeof record.result_data === 'string' ? JSON.parse(record.result_data) : record.result_data;
    let uploadedData = typeof record.uploaded_data === 'string' ? JSON.parse(record.uploaded_data) : (record.uploaded_data || []);

    // Cap the search endDate to the file's compare_date so we never match future sales
    const compareDateStr = record.compare_date instanceof Date 
      ? record.compare_date.toISOString().split('T')[0] 
      : String(record.compare_date).split('T')[0];
    const maxEndDate = endDate > compareDateStr ? compareDateStr : endDate;

    // 2. Identify missing numbers
    const missingPhones = resultData.filter(d => d.status === 'Not Found').map(d => d.phone);
    if (missingPhones.length === 0) {
      return res.json({ success: true, message: 'No missing numbers to recheck', data: record });
    }

    // 3. Query dialer_sales_history for these phones in the new date range
    const placeholders = missingPhones.map((_, i) => `$${i + 4}`).join(',');
    const findSql = `
      SELECT phone, status, agent, team, sale_date
      FROM dialer_sales_history
      WHERE dialer = $1 
        AND sale_date >= $2 
        AND sale_date <= $3
        AND phone IN (${placeholders})
    `;
    const findValues = [dialerType, startDate, maxEndDate, ...missingPhones];
    const foundResult = await query(findSql, findValues);

    if (foundResult.rowCount === 0) {
      return res.json({ success: true, message: 'No new numbers found', data: record });
    }

    // 4. Group found numbers by sale_date
    const foundByDate = {};
    const allFoundPhones = new Set();
    
    foundResult.rows.forEach(r => {
      // Prioritize preserving team info
      if (!allFoundPhones.has(r.phone) || (r.team && r.team !== '-')) {
         allFoundPhones.add(r.phone);
         
         const dateStr = r.sale_date instanceof Date ? r.sale_date.toISOString().split('T')[0] : String(r.sale_date).split('T')[0];
         
         if (!foundByDate[dateStr]) {
           foundByDate[dateStr] = [];
         }
         
         // Remove if it already exists for this date to avoid duplicates
         foundByDate[dateStr] = foundByDate[dateStr].filter(item => item.phone !== r.phone);
         
         foundByDate[dateStr].push({
           phone: r.phone,
           status: r.status,
           agent: r.agent || '-',
           team: r.team || '-'
         });
      }
    });

    const totalFoundCount = allFoundPhones.size;
    if (totalFoundCount === 0) {
      return res.json({ success: true, message: 'No new numbers found', data: record });
    }

    // 5. Update Source Record (Remove found ones completely)
    const newResultData = resultData.filter(item => !allFoundPhones.has(item.phone));
    const newUploadedData = uploadedData.filter(phone => !allFoundPhones.has(phone));
    const newNotFound = Math.max(0, record.not_found - totalFoundCount);
    const newTotalUploaded = Math.max(0, record.total_uploaded - totalFoundCount);

    const updateSourceSql = `
      UPDATE compare_history 
      SET result_data = $1, uploaded_data = $2, not_found = $3, total_uploaded = $4
      WHERE id = $5
      RETURNING *
    `;
    const updateSourceResult = await query(updateSourceSql, [
      JSON.stringify(newResultData), 
      JSON.stringify(newUploadedData), 
      newNotFound, 
      newTotalUploaded, 
      id
    ]);

    // 6. Process Target Records (Move to specific dates)
    for (const [dateStr, items] of Object.entries(foundByDate)) {
      const itemsCount = items.length;
      const justPhones = items.map(i => i.phone);
      
      // Look for an existing record for this date and dialer
      const targetQuery = await query(`
        SELECT * FROM compare_history 
        WHERE compare_date = $1 AND dialer_type = $2 
        ORDER BY created_at DESC LIMIT 1
      `, [dateStr, dialerType]);

      if (targetQuery.rowCount > 0) {
        // Append to existing record
        const targetRecord = targetQuery.rows[0];
        let tResult = typeof targetRecord.result_data === 'string' ? JSON.parse(targetRecord.result_data) : (targetRecord.result_data || []);
        let tUploaded = typeof targetRecord.uploaded_data === 'string' ? JSON.parse(targetRecord.uploaded_data) : (targetRecord.uploaded_data || []);
        
        tResult = [...tResult, ...items];
        tUploaded = [...tUploaded, ...justPhones];
        
        const tTotalUploaded = targetRecord.total_uploaded + itemsCount;
        const tTotalFound = targetRecord.total_found + itemsCount;
        
        await query(`
          UPDATE compare_history 
          SET result_data = $1, uploaded_data = $2, total_uploaded = $3, total_found = $4
          WHERE id = $5
        `, [JSON.stringify(tResult), JSON.stringify(tUploaded), tTotalUploaded, tTotalFound, targetRecord.id]);
        
      } else {
        // Create new record
        const fileName = `Backfilled from ${record.file_name}`;
        await query(`
          INSERT INTO compare_history 
          (user_id, file_name, dialer_type, compare_date, total_uploaded, total_found, not_found, uploaded_data, result_data)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          record.user_id, 
          fileName, 
          dialerType, 
          dateStr, 
          itemsCount, 
          itemsCount, 
          0, 
          JSON.stringify(justPhones), 
          JSON.stringify(items)
        ]);
      }
    }

    res.json({ 
      success: true, 
      message: `Moved ${totalFoundCount} numbers to their respective sale dates!`, 
      data: updateSourceResult.rows[0] 
    });

  } catch (error) {
    console.error('Error in recheckCompareHistory:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /dialer-sales/sync-hrms-test
// Sends one hardcoded test record to HRMS — useful for verifying integration.
exports.syncHrmsTest = async (req, res) => {
  try {
    const testRecord = {
      lead_id:           'TEST-QA-LOCAL-D5-001',
      status:            'D5',
      qa_status:         'Pending',
      phone_number:      '3183060984',
      customer_name:     'Test Customer',
      team:              'MED_IN',
      dialer_agent_name: 'Muhammad Shabbir (5053)',
      last_call_at:      new Date().toISOString(),
    };

    // Do a real awaited (not fire-and-forget) call so we can return HRMS response
    const url    = process.env.HRMS_SYNC_URL;
    const secret = process.env.HRMS_SYNC_SECRET;

    if (!url || !secret) {
      return res.status(500).json({ success: false, message: 'HRMS_SYNC_URL or HRMS_SYNC_SECRET not set in .env' });
    }

    const https = require('https');
    const http  = require('http');
    const payload = JSON.stringify({ secret, records: [testRecord] });

    const result = await new Promise((resolve, reject) => {
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
        timeout: 15000,
      };
      const req = lib.request(options, (resp) => {
        let data = '';
        resp.on('data', d => { data += d; });
        resp.on('end', () => {
          try { resolve({ status: resp.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: resp.statusCode, body: data }); }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    return res.json({
      success: true,
      message: 'Test record sent to HRMS',
      test_record: testRecord,
      hrms_status:   result.status,
      hrms_response: result.body,
    });
  } catch (error) {
    console.error('[HRMS Test] Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
