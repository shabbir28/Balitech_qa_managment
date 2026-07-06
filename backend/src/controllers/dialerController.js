// Vicidial Agent API Controller
// API Docs: agc/api.php (Vicidial Agent API)
// Requires: vdc_agent_api_access=1 on user AND vdc_agent_api_active=1 in system_settings

const DIALER_API_URL = process.env.DIALER_API_URL || 'https://bt1.dialerhosting.com/agc/api.php';
const DIALER_USER    = process.env.DIALER_API_USER || 'CRM_API';
const DIALER_PASS    = process.env.DIALER_API_PASS || 'test123dssddscc';
const DIALER_SOURCE  = process.env.DIALER_SOURCE   || 'qa_system';
const RECORDINGS_BASE = process.env.DIALER_RECORDINGS_URL || 'http://167.235.117.217/RECORDINGS/MP3';

/**
 * Call Vicidial agc/api.php and return parsed pipe-delimited response
 * Response format: KEY: VALUE|KEY2: VALUE2|...
 */
async function callDialerAPI(params) {
  const qs = new URLSearchParams({
    source: DIALER_SOURCE,
    user: DIALER_USER,
    pass: DIALER_PASS,
    ...params,
  });
  const url = `${DIALER_API_URL}?${qs.toString()}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const text = (await res.text()).trim();
  return text;
}

/**
 * Parse Vicidial pipe-delimited response into array of objects.
 * 
 * lead_search returns rows separated by newline, each row is pipe-separated fields:
 *   lead_id|status|vendor_lead_code|last_local_call_time|phone_number|...
 * The first line contains headers.
 */
function parseDialerRows(raw) {
  if (!raw || raw.length === 0) return null;

  // Check for explicit error messages
  if (raw.startsWith('ERROR:')) return { error: raw };

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // If only one line — might be single key:value block
  if (lines.length === 1) {
    const obj = {};
    const parts = lines[0].split('|');
    parts.forEach(p => {
      const [k, ...v] = p.split(':');
      if (k) obj[k.trim()] = v.join(':').trim();
    });
    return obj;
  }

  // Multi-line: first line = headers, rest = data rows
  const headers = lines[0].split('|').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const cols = line.split('|');
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
    return row;
  });
  return rows;
}

// ─── Search lead by phone number ──────────────────────────────────────────────
exports.searchLead = async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    // Clean phone number — remove spaces, dashes, +1 prefix
    const cleanPhone = phone.replace(/\D/g, '').replace(/^1/, '');

    let raw;
    try {
      raw = await callDialerAPI({
        function: 'lead_search',
        phone_number: cleanPhone,
        query_fields: 'lead_id,status,vendor_lead_code,last_local_call_time,phone_number,list_id,user,first_name,last_name',
      });
    } catch (fetchErr) {
      console.error('[Dialer] Network error:', fetchErr.message);
      return res.status(503).json({
        success: false,
        message: 'Dialer server unreachable. Check DIALER_API_URL.',
        apiError: fetchErr.message,
      });
    }

    console.log(`[Dialer] lead_search(${cleanPhone}) raw response length: ${raw?.length ?? 0}`);

    // Empty response = auth failed (vdc_agent_api_access not enabled)
    if (!raw || raw.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Dialer API access denied. Admin must enable: (1) System Settings → Agent API Active = YES, (2) User CRM_API → Agent API Access = 1.',
        fix: {
          step1: 'Admin Panel → Admin → System Settings → Agent API Active = YES → SUBMIT',
          step2: 'Admin Panel → Admin → Users → CRM_API → Modify → Agent API Access = 1 → SUBMIT',
        },
      });
    }

    const parsed = parseDialerRows(raw);

    if (parsed && parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error, raw });
    }

    // Normalize the result into a consistent leads array
    const leads = Array.isArray(parsed)
      ? parsed.map(r => ({
          lead_id:    r.lead_id    || r['lead_id'],
          status:     r.status     || '',
          vendor_id:  r.vendor_lead_code || '',
          last_agent: r.user       || '',
          list_id:    r.list_id    || '',
          phone:      r.phone_number || cleanPhone,
          name:       [r.first_name, r.last_name].filter(Boolean).join(' '),
          last_call:  r.last_local_call_time || '',
        }))
      : [];

    return res.json({
      success: true,
      data: { total: leads.length, leads, raw },
    });

  } catch (error) {
    next(error);
  }
};

// ─── Get detailed info for a specific lead ────────────────────────────────────
exports.getLeadInfo = async (req, res, next) => {
  try {
    const { leadId } = req.params;

    let raw;
    try {
      raw = await callDialerAPI({
        function: 'lead_field_info',
        lead_id: leadId,
        query_fields: 'lead_id,list_id,user,called_count,last_local_call_time,phone_number,phone_code,status,vendor_lead_code,first_name,last_name,address1,city,state,postal_code,comments',
      });
    } catch (fetchErr) {
      return res.status(503).json({ success: false, message: 'Dialer server unreachable.', apiError: fetchErr.message });
    }

    console.log(`[Dialer] lead_field_info(${leadId}) raw: ${raw?.length ?? 0} chars`);

    if (!raw || raw.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Dialer API access denied. Admin must enable Agent API Access for CRM_API user.',
      });
    }

    const parsed = parseDialerRows(raw);
    if (parsed && parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error, raw });
    }

    const info = Array.isArray(parsed) ? parsed[0] : parsed;

    return res.json({
      success: true,
      data: {
        lead_id:     info?.lead_id    || leadId,
        list_id:     info?.list_id    || '',
        user:        info?.user       || '',
        called_count: parseInt(info?.called_count || '0'),
        last_call:   info?.last_local_call_time || '',
        phone:       info?.phone_number || '',
        dialcode:    info?.phone_code  || '1',
        status:      info?.status     || '',
        name:        [info?.first_name, info?.last_name].filter(Boolean).join(' '),
        address:     info?.address1   || '',
        city:        info?.city       || '',
        state:       info?.state      || '',
        postal_code: info?.postal_code || '',
        comments:    info?.comments   || '',
        raw,
      },
    });

  } catch (error) {
    next(error);
  }
};

// ─── Get recordings for a lead ────────────────────────────────────────────────
exports.getRecordings = async (req, res, next) => {
  try {
    const { leadId } = req.params;

    let raw;
    try {
      raw = await callDialerAPI({
        function: 'recording_lookup',
        lead_id: leadId,
        query_fields: 'lead_id,call_date,length_in_sec,filename,location,user',
      });
    } catch (fetchErr) {
      return res.status(503).json({ success: false, message: 'Dialer server unreachable.', apiError: fetchErr.message });
    }

    console.log(`[Dialer] recording_lookup(${leadId}) raw: ${raw?.length ?? 0} chars`);

    if (!raw || raw.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Dialer API access denied. Admin must enable Agent API Access for CRM_API user.',
      });
    }

    const parsed = parseDialerRows(raw);
    if (parsed && parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error, raw });
    }

    const rows = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);

    const recordings = rows.map(r => ({
      lead_id:  r.lead_id  || leadId,
      date:     r.call_date || r.date || '',
      length:   r.length_in_sec || r.length || '0',
      filename: r.filename || '',
      location: r.location || (r.filename
        ? `${RECORDINGS_BASE}/${r.filename}-all.mp3`
        : ''),
      tsr:      r.user || '',
    }));

    return res.json({ success: true, data: recordings, raw });

  } catch (error) {
    next(error);
  }
};
