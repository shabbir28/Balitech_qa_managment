const { fetchAdminPage, extractLeadsFromHtml } = require('./dialerController');

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
  statuses.add('SALE'); // Always include default SALE status

  try {
    // 1. Fetch system statuses
    const sysHtml = await fetchAdminPage('admin.php?ADD=3', dialerType);
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
        const cStatHtml = await fetchAdminPage(`admin.php?ADD=34&campaign_id=${campaignId}`, dialerType);
        parseStatusesHtml(cStatHtml, statuses);
      } catch (err) {
        console.error(`Failed to fetch statuses for campaign ${campaignId} on ${dialerType}`);
      }
    }

    const result = [...statuses];
    saleStatusesCache[dialerType] = {
      statuses: result,
      lastFetched: now
    };
    return result;

  } catch (error) {
    console.error('Error in getSaleStatuses:', error);
    // fallback if error and we have cache
    if (saleStatusesCache[dialerType].statuses) {
      return saleStatusesCache[dialerType].statuses;
    }
    // minimal default
    return ['SALE']; 
  }
}

function parseStatusesHtml(html, statusSet) {
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows) return;
  for (const row of rows) {
    // Look for status row modify link (ADD=4 for system, ADD=35 for campaign)
    if (row.includes('admin.php?ADD=4&status=') || row.includes('admin.php?ADD=35&campaign_id=')) {
      const cols = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (cols && cols.length >= 6) {
        const clean = (str) => str.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().replace(/\s+/g, ' ');
        // For campaign statuses, columns are often 
        // 0: status, 1: desc, 2: selectable, 3: human answer, 4: sale ...
        // We will just check if any column exactly equals 'Y' and is in index 4, OR if we just check if index 4 is 'Y'
        // Let's check index 4 for 'Y' (usually Sale is column 4 or 5)
        // A safer way is to check if the row explicitly marks Sale as Y in vicidial HTML format, but checking column 4 is standard.
        const status = clean(cols[0]);
        let isSale = false;
        
        // System statuses: Sale is usually index 4
        // Campaign statuses: Sale is usually index 4
        if (clean(cols[4]) === 'Y' || status.toUpperCase().includes('SALE')) {
          isSale = true;
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
    const { dialer = 'pharmacy' } = req.query;
    
    // Get sale statuses
    const statuses = await getSaleStatuses(dialer);
    console.log(`Sale statuses for ${dialer}:`, statuses);
    
    if (!statuses || statuses.length === 0) {
      return res.json({ success: true, data: [] });
    }

    let allLeads = [];
    
    // Fetch leads for each status
    // To avoid timeouts, we can run them in chunks or sequentially
    for (const status of statuses) {
      try {
        const body = new URLSearchParams({ status: status, SUBMIT: 'SUBMIT' }).toString();
        const html = await fetchAdminPage('admin_search_lead.php', dialer, 'POST', body);
        const leads = extractLeadsFromHtml(html);
        allLeads = allLeads.concat(leads);
      } catch (err) {
        console.error(`Error fetching leads for status ${status}:`, err);
      }
    }

    // Deduplicate leads by lead_id just in case
    const uniqueLeadsMap = new Map();
    allLeads.forEach(lead => {
      if (!uniqueLeadsMap.has(lead.lead_id)) {
        uniqueLeadsMap.set(lead.lead_id, lead);
      }
    });

    const finalLeads = Array.from(uniqueLeadsMap.values());
    
    // Sort by last_call descending (basic string sort)
    finalLeads.sort((a, b) => b.last_call.localeCompare(a.last_call));

    return res.json({
      success: true,
      data: finalLeads,
      statuses: statuses
    });

  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sales leads' });
  }
};

exports.syncStatuses = async (req, res) => {
  try {
    const { dialer = 'pharmacy' } = req.body;
    // Force cache expiry
    saleStatusesCache[dialer].lastFetched = 0;
    const statuses = await getSaleStatuses(dialer);
    res.json({ success: true, message: 'Statuses synced successfully', statuses });
  } catch (error) {
    console.error('Error syncing statuses:', error);
    res.status(500).json({ success: false, message: 'Failed to sync statuses' });
  }
};
