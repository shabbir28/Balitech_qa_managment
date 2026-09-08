// Vicidial Admin Scraper Controller
// Uses HTTP Basic Auth to scrape admin_search_lead.php and admin_modify_lead.php

const { query } = require('../config/database');

function getDialerConfig(type) {
  const stripFile = (url) => (url.includes('.php') ? url.replace(/\/[^/]+$/, '') : url);

  if (type === 'medicare') {
    const rawUrl = process.env.MEDICARE_DIALER_URL;
    const user = process.env.MEDICARE_DIALER_USER;
    const pass = process.env.MEDICARE_DIALER_PASS;
    if (!rawUrl || !user || !pass) {
      throw new Error('Medicare dialer is not configured. Set MEDICARE_DIALER_URL, MEDICARE_DIALER_USER and MEDICARE_DIALER_PASS.');
    }
    return { baseUrl: stripFile(rawUrl), user, pass, name: 'Medicare Dialer' };
  }

  // Default to Pharmacy
  const rawUrl = process.env.PHARMACY_DIALER_URL || process.env.DIALER_API_URL;
  const user = process.env.PHARMACY_DIALER_USER || process.env.DIALER_API_USER;
  const pass = process.env.PHARMACY_DIALER_PASS || process.env.DIALER_API_PASS;
  if (!rawUrl || !user || !pass) {
    throw new Error('Pharmacy dialer is not configured. Set PHARMACY_DIALER_URL, PHARMACY_DIALER_USER and PHARMACY_DIALER_PASS.');
  }
  return { baseUrl: stripFile(rawUrl), user, pass, name: 'Pharmacy Dialer' };
}

const RECORDINGS_BASE = process.env.DIALER_RECORDINGS_URL || 'http://167.235.117.217/RECORDINGS/MP3';

// Helper to fetch HTML
exports.fetchAdminPage = async function fetchAdminPage(path, dialerType = 'pharmacy', method = 'GET', body = null) {
  const config = getDialerConfig(dialerType);
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const url = path.startsWith('http') ? path : `${baseUrl}/${path}`;
  const authHeader = 'Basic ' + Buffer.from(`${config.user}:${config.pass}`).toString('base64');
  
  const options = {
    method,
    headers: { Authorization: authHeader },
    signal: AbortSignal.timeout(60000),
  };
  if (body && method === 'POST') {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = body;
  }
  
  const res = await fetch(url, options);
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Authentication failed for ${config.name} Admin`);
  }
  return await res.text();
}

// Extract rows from HTML table
exports.extractLeadsFromHtml = function extractLeadsFromHtml(html) {
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
    const { phone, dialer = 'pharmacy' } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const cleanPhone = phone.replace(/\D/g, '').replace(/^1/, '');

    try {
      console.log('Searching for:', cleanPhone, 'in', dialer);
      const body = new URLSearchParams({ phone: cleanPhone, SUBMIT: 'SUBMIT' }).toString();
      const html = await exports.fetchAdminPage('admin_search_lead.php', dialer, 'POST', body);
      
      const leads = exports.extractLeadsFromHtml(html);
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
async function fetchLeadDetails(leadId, dialerType = 'pharmacy') {
  const html = await exports.fetchAdminPage(`admin_modify_lead.php?lead_id=${leadId}`, dialerType);
  
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

  const extractTextElement = (label) => {
    // Looks for "User: <A HREF...>6068</A>&nbsp;" or "Last Call: 2026-08-11 09:32:30</td>"
    const rx = new RegExp(`${label}\\s*([\\s\\S]*?)(?:&nbsp;|<\/td>)`, 'i');
    const m = html.match(rx);
    if (m) {
      // Clean tags if it's inside an anchor like <A>...
      return m[1].replace(/<[^>]+>/g, '').trim();
    }
    return '';
  };

  let status = extractField('status');
  if (!status) {
    // Check hidden input
    const rxHidden = /name=["']?dispo["']?[^>]*value=["']?([^"'>]*)["']?/i;
    const mHidden = html.match(rxHidden);
    if (mHidden && mHidden[1]) {
      status = mHidden[1].trim();
    }
  }
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
    list_id:     extractField('list_id') || extractTextElement('List ID:'),
    user:        extractTextElement('User:'),
    called_count: parseInt(extractTextElement('Called Count:') || '0'),
    last_call:   extractTextElement('Last Call:'),
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
    const { dialer = 'pharmacy' } = req.query;
    const data = await fetchLeadDetails(leadId, dialer);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.importLeadForEval = async (req, res, next) => {
  try {
    const { lead_id, recording_url, agent_name, dialer = 'pharmacy', recordings = [] } = req.body;
    if (!lead_id || !recording_url) {
      return res.status(400).json({ success: false, message: 'lead_id and recording_url are required' });
    }

    // Format recordings JSON
    let recsJson = JSON.stringify(Array.isArray(recordings) ? recordings : []);

    // Check if already imported by recording_url OR lead assignment
    const existing = await query(
      `SELECT id, campaign_name, recordings FROM call_leads 
       WHERE (
         recording_url = $1 
         OR (notes LIKE $2 AND is_evaluated = FALSE)
         OR (notes LIKE $3 AND is_evaluated = FALSE)
         OR (notes LIKE $4 AND is_evaluated = FALSE)
       ) AND is_deleted = FALSE LIMIT 1`,
      [recording_url, `%VICI_LEAD:${lead_id}%`, `%Lead ID: ${lead_id}%`, `%Lead ID:${lead_id}%`]
    );
    if (existing.rows.length > 0) {
      const existingId = existing.rows[0].id;
      
      // Update agent_name, recording_url and merge/update recordings
      await query(
        `UPDATE call_leads 
         SET agent_name = COALESCE($1, agent_name),
             recording_url = $2,
             recordings = CASE WHEN $3::jsonb != '[]'::jsonb THEN $3::jsonb ELSE recordings END,
             updated_at = NOW()
         WHERE id = $4`,
        [agent_name || null, recording_url, recsJson, existingId]
      );
      
      // Auto-assign to self so it appears in the evaluations list
      await query(
        `INSERT INTO lead_assignments (call_lead_id, assigned_to, assigned_by, campaign_name, status, notes) 
         VALUES ($1, $2, $3, $4, 'pending', 'Self-assigned via direct evaluation') 
         ON CONFLICT DO NOTHING`,
        [existingId, req.user.id, req.user.id, existing.rows[0].campaign_name || '']
      );
      
      return res.json({ success: true, call_id: existingId });
    }

    // Fetch details from dialer
    const lead = await fetchLeadDetails(lead_id, dialer);

    // Default call_date fallback
    let callDate = lead.last_call ? new Date(lead.last_call) : new Date();
    if (isNaN(callDate)) callDate = new Date();

    const campaignName = dialer === 'medicare' ? 'Medicare Dialer' : 'Pharmacy Dialer';

    const insertRes = await query(
      `INSERT INTO call_leads (agent_name, agent_id, campaign_name, customer_name, customer_phone, call_date, recording_url, disposition, recordings, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        agent_name || lead.user || 'Unknown', 
        lead.user || 'Unknown', 
        campaignName, 
        lead.name || 'Unknown', 
        lead.phone || 'Unknown', 
        callDate.toISOString(), 
        recording_url, 
        lead.status || 'NEW',
        recsJson,
        `VICI_LEAD:${lead_id}`
      ]
    );

    const newCallId = insertRes.rows[0].id;

    // Auto-assign to self so it appears in the evaluations list
    await query(
      `INSERT INTO lead_assignments (call_lead_id, assigned_to, assigned_by, campaign_name, status, notes) 
       VALUES ($1, $2, $3, $4, 'pending', 'Self-assigned via direct evaluation') 
       ON CONFLICT DO NOTHING`,
      [newCallId, req.user.id, req.user.id, campaignName]
    );

    return res.json({ success: true, call_id: newCallId });
  } catch (error) {
    next(error);
  }
};

// ─── Get recordings for a lead ────────────────────────────────────────────────
exports.getRecordings = async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const { dialer = 'pharmacy' } = req.query;
    const html = await exports.fetchAdminPage(`admin_modify_lead.php?lead_id=${leadId}`, dialer);
    
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

/**
 * Proxy stream download for recording audio to prevent opening new tab or CORS errors.
 * Supports HTTP redirect following and validates URLs to allowed recording hosts only.
 */
exports.downloadAudio = async (req, res, next) => {
  try {
    let { url, filename } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }

    // Fix https to http for bare IP addresses to avoid invalid SSL cert errors
    if (url.startsWith('https://') && /^\d+\.\d+\.\d+\.\d+/.test(new URL(url).hostname)) {
      url = url.replace('https://', 'http://');
    }

    // ── SSRF Protection: Only allow known recording origins ─────────────────
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid URL format' });
    }

    // Allowed protocols only
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ success: false, message: 'Only HTTP/HTTPS URLs are allowed' });
    }

    // Build allowed hosts from env config (recording server IPs / domains)
    const allowedHosts = new Set();
    const allowedDomainSuffixes = new Set(); // allow any subdomain of these domains

    const recordingsBase = process.env.DIALER_RECORDINGS_URL || 'http://167.235.117.217/RECORDINGS/MP3';
    try { allowedHosts.add(new URL(recordingsBase).hostname); } catch {}
    const pharmacyUrl = process.env.PHARMACY_DIALER_URL || process.env.DIALER_API_URL;
    if (pharmacyUrl) { try {
      const h = new URL(pharmacyUrl).hostname;
      allowedHosts.add(h);
      // Also allow the parent domain (e.g., dialerhosting.com from bt1.dialerhosting.com)
      const parts = h.split('.');
      if (parts.length >= 2) allowedDomainSuffixes.add(parts.slice(-2).join('.'));
    } catch {} }
    const medicareUrl = process.env.MEDICARE_DIALER_URL;
    if (medicareUrl) { try {
      const h = new URL(medicareUrl).hostname;
      allowedHosts.add(h);
      const parts = h.split('.');
      if (parts.length >= 2) allowedDomainSuffixes.add(parts.slice(-2).join('.'));
    } catch {} }
    // Also allow the specific known Vicidial recording IP as a safety fallback
    allowedHosts.add('167.235.117.217');
    // Allow any subdomain of dialerhosting.com since recordings use different subdomains
    allowedDomainSuffixes.add('dialerhosting.com');
    allowedDomainSuffixes.add('vicidial.net');
    allowedDomainSuffixes.add('vicidial.org');

    const hostname = parsedUrl.hostname;
    const domainParts = hostname.split('.');
    const parentDomain = domainParts.slice(-2).join('.');
    const isAllowed = allowedHosts.has(hostname) || allowedDomainSuffixes.has(parentDomain);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: `Recording URL hostname '${hostname}' is not an allowed recording source`
      });
    }

    const cleanFilename = (filename || parsedUrl.pathname.split('/').pop() || 'recording.mp3')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFilename = (cleanFilename.endsWith('.mp3') || cleanFilename.endsWith('.wav'))
      ? cleanFilename
      : `${cleanFilename}.mp3`;

    // ── Stream with redirect support (follow up to 5 redirects) ─────────────
    let currentUrl = url;
    let redirectCount = 0;
    const MAX_REDIRECTS = 5;

    const doStream = () => {
      const client = currentUrl.startsWith('https://') ? require('https') : require('http');

      client.get(currentUrl, (streamRes) => {
        // Handle redirects properly (no recursive req spread)
        if (streamRes.statusCode >= 300 && streamRes.statusCode < 400 && streamRes.headers.location) {
          streamRes.resume(); // consume and discard body
          if (redirectCount >= MAX_REDIRECTS) {
            if (!res.headersSent) {
              return res.status(500).json({ success: false, message: 'Too many redirects' });
            }
            return;
          }
          redirectCount++;
          // Resolve relative redirects
          try {
            currentUrl = new URL(streamRes.headers.location, currentUrl).toString();
            // Fix https to http for bare IPs on redirects too
            if (currentUrl.startsWith('https://') && /^\d+\.\d+\.\d+\.\d+/.test(new URL(currentUrl).hostname)) {
              currentUrl = currentUrl.replace('https://', 'http://');
            }
          } catch {
            if (!res.headersSent) {
              return res.status(500).json({ success: false, message: 'Invalid redirect URL' });
            }
            return;
          }
          return doStream();
        }

        if (streamRes.statusCode !== 200) {
          if (!res.headersSent) {
            return res.status(streamRes.statusCode || 502).json({
              success: false,
              message: `Failed to fetch audio stream: upstream returned status ${streamRes.statusCode}`
            });
          }
          return;
        }

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Content-Type', streamRes.headers['content-type'] || 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        if (streamRes.headers['content-length']) {
          res.setHeader('Content-Length', streamRes.headers['content-length']);
        }

        streamRes.pipe(res);
        streamRes.on('error', (err) => {
          console.error('Error piping audio stream:', err.message);
        });
      }).on('error', (err) => {
        console.error('Error in downloadAudio proxy:', err.message);
        if (!res.headersSent) {
          res.status(502).json({ success: false, message: 'Audio stream download failed: ' + err.message });
        }
      });
    };

    doStream();
  } catch (error) {
    next(error);
  }
};

