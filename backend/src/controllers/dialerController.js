// Vicidial Admin Scraper Controller
// Uses HTTP Basic Auth to scrape admin_search_lead.php and admin_modify_lead.php

const DIALER_BASE    = process.env.DIALER_API_URL && process.env.DIALER_API_URL.includes('.php') 
  ? process.env.DIALER_API_URL.replace(/\/[^\/]+$/, '') 
  : (process.env.DIALER_API_URL || 'https://bt1.dialerhosting.com/BkLuyT');
const DIALER_USER    = process.env.DIALER_API_USER || 'CRM_API';
const DIALER_PASS    = process.env.DIALER_API_PASS || 'test123dssddscc';
const RECORDINGS_BASE = process.env.DIALER_RECORDINGS_URL || 'http://167.235.117.217/RECORDINGS/MP3';

const AUTH_HEADER = 'Basic ' + Buffer.from(`${DIALER_USER}:${DIALER_PASS}`).toString('base64');

// Helper to fetch HTML
async function fetchAdminPage(path, method = 'GET', body = null) {
  const baseUrl = DIALER_BASE.replace(/\/+$/, '');
  const url = path.startsWith('http') ? path : `${baseUrl}/${path}`;
  const options = {
    method,
    headers: { Authorization: AUTH_HEADER },
    signal: AbortSignal.timeout(15000),
  };
  if (body && method === 'POST') {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = body;
  }
  
  const res = await fetch(url, options);
  if (res.status === 401 || res.status === 403) {
    throw new Error('Authentication failed for Vicidial Admin');
  }
  return await res.text();
}

// Extract rows from HTML table
function extractLeadsFromHtml(html) {
  const leads = [];
  // Find table rows
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows) return leads;

  for (const rowHtml of rows) {
    // Only process rows that look like lead results (have lead_id link)
    if (rowHtml.includes('admin_modify_lead.php?lead_id=')) {
      const tdMatches = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (tdMatches && tdMatches.length >= 10) {
        // Clean text helper
        const clean = (td) => td.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        
        leads.push({
          lead_id:    clean(tdMatches[1]),
          status:     clean(tdMatches[2]),
          vendor_id:  clean(tdMatches[3]),
          last_agent: clean(tdMatches[4]),
          list_id:    clean(tdMatches[5]),
          phone:      clean(tdMatches[6]),
          name:       clean(tdMatches[7]),
          city:       clean(tdMatches[8]),
          security:   clean(tdMatches[9]),
          last_call:  clean(tdMatches[10] || ''),
        });
      }
    }
  }
  return leads;
}

// ─── Search lead by phone number ──────────────────────────────────────────────
exports.searchLead = async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const cleanPhone = phone.replace(/\D/g, '').replace(/^1/, '');

    try {
      console.log('Searching for:', cleanPhone);
      const body = new URLSearchParams({ phone: cleanPhone, SUBMIT: 'SUBMIT' }).toString();
      const html = await fetchAdminPage('admin_search_lead.php', 'POST', body);
      
      const leads = extractLeadsFromHtml(html);
      console.log('Extracted leads count:', leads.length);
      
      return res.json({
        success: true,
        data: { total: leads.length, leads, raw: 'Scraped from admin_search_lead.php' },
      });
    } catch (err) {
      if (err.message.includes('Authentication')) {
         return res.status(403).json({ success: false, message: 'Vicidial Admin Auth Failed. Check DIALER_API_USER and PASS.' });
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

// Helper to extract lead details from dialer
async function fetchLeadDetails(leadId) {
  const html = await fetchAdminPage(`admin_modify_lead.php?lead_id=${leadId}`);
  
  const extractField = (name) => {
    const rx = new RegExp(`name=["']?${name}["']?\\s+[^>]*value=["']?([^"'>\\s]*)["']?`, 'i');
    const m = html.match(rx);
    if (!m) {
      const rx2 = new RegExp(`name=["']?${name}["']?[^>]*value=["']?([^"'>]*)["']?`, 'i');
      const m2 = html.match(rx2);
      return m2 ? m2[1].trim() : '';
    }
    return m ? m[1].trim() : '';
  };

  let status = extractField('status');
  if (!status) {
    const rxSelect = /<select[^>]*name=["']?status["']?[^>]*>([\s\S]*?)<\/select>/gi;
    const mSelect = rxSelect.exec(html);
    if (mSelect) {
      const rxOption = /<option[^>]*selected[^>]*value=["']?([^"'>\s]*)["']?/i;
      const mOption = mSelect[1].match(rxOption);
      status = mOption ? mOption[1].trim() : '';
    }
  }

  return {
    lead_id:     leadId,
    list_id:     extractField('list_id'),
    user:        extractField('user'),
    called_count: parseInt(extractField('called_count') || '0'),
    last_call:   extractField('last_local_call_time'),
    phone:       extractField('phone_number'),
    dialcode:    extractField('phone_code') || '1',
    status:      status,
    name:        [extractField('first_name'), extractField('last_name')].filter(Boolean).join(' '),
    address:     extractField('address1'),
    city:        extractField('city'),
    state:       extractField('state'),
    postal_code: extractField('postal_code'),
    comments:    extractField('comments'),
    raw: 'Scraped from admin_modify_lead.php'
  };
}

// ─── Get detailed info for a specific lead ────────────────────────────────────
exports.getLeadInfo = async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const data = await fetchLeadDetails(leadId);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ─── Import lead into local DB for evaluation ─────────────────────────────────
const { query } = require('../config/database');

exports.importLeadForEval = async (req, res, next) => {
  try {
    const { lead_id, recording_url } = req.body;
    if (!lead_id || !recording_url) {
      return res.status(400).json({ success: false, message: 'lead_id and recording_url are required' });
    }

    // Check if already imported by recording_url
    const existing = await query('SELECT id FROM call_leads WHERE recording_url = $1 AND is_deleted = FALSE LIMIT 1', [recording_url]);
    if (existing.rows.length > 0) {
      return res.json({ success: true, call_id: existing.rows[0].id });
    }

    // Fetch details from dialer
    const lead = await fetchLeadDetails(lead_id);

    // Default call_date fallback
    let callDate = lead.last_call ? new Date(lead.last_call) : new Date();
    if (isNaN(callDate)) callDate = new Date();

    const insertRes = await query(
      `INSERT INTO call_leads (agent_name, agent_id, campaign_name, customer_name, customer_phone, call_date, recording_url, disposition) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        lead.user || 'Unknown', 
        lead.user || 'Unknown', 
        'Dialer Campaign', 
        lead.name || 'Unknown', 
        lead.phone || 'Unknown', 
        callDate.toISOString(), 
        recording_url, 
        lead.status || 'NEW'
      ]
    );

    return res.json({ success: true, call_id: insertRes.rows[0].id });
  } catch (error) {
    next(error);
  }
};

// ─── Get recordings for a lead ────────────────────────────────────────────────
exports.getRecordings = async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const html = await fetchAdminPage(`admin_modify_lead.php?lead_id=${leadId}`);
    
    const recordings = [];
    
    // Find any hrefs that contain .mp3 or .wav
    const allLinks = html.match(/href=["']([^"']+)["']/gi);
    if (allLinks) {
      allLinks.forEach((linkHtml) => {
        const urlMatch = linkHtml.match(/href=["']([^"']+)["']/i);
        if (urlMatch) {
          let recUrl = urlMatch[1];
          if (recUrl.toLowerCase().includes('.mp3') || recUrl.toLowerCase().includes('.wav')) {
            if (recUrl.startsWith('/')) {
               recUrl = `http://167.235.117.217${recUrl}`;
            }
            // Fix https to http for IP addresses to avoid ERR_CERT_COMMON_NAME_INVALID
            if (recUrl.startsWith('https://') && /\d+\.\d+\.\d+\.\d+/.test(recUrl)) {
               recUrl = recUrl.replace('https://', 'http://');
            }
            
            const filename = recUrl.split('/').pop();
            // Prevent duplicates
            if (!recordings.some(r => r.location === recUrl)) {
              recordings.push({
                lead_id:  leadId,
                date:     '', 
                length:   '0',
                filename: filename,
                location: recUrl,
                tsr:      '',
              });
            }
          }
        }
      });
    }

    return res.json({ success: true, data: recordings, raw: 'Scraped from admin_modify_lead.php' });
  } catch (error) {
    next(error);
  }
};
