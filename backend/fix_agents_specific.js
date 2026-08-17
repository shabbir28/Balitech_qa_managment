require('dotenv').config();
const { query } = require('./src/config/database');
const { fetchAdminPage } = require('./src/controllers/dialerController');

async function getSaleStatuses(dialerType) {
  // Hardcode for this fix script to avoid complex cache logic
  const statuses = ['D2', 'D3', 'D4', 'D5', 'D6CPL', 'D7', 'D8', 'HI', 'HI2', 'HIB', 'HIC', 'HIMAIN'];
  return statuses;
}

async function fixAgentNames() {
  try {
    const statuses = await getSaleStatuses('medicare');
    
    // Dates to fix (including 12th, 13th, 14th)
    const dates = [
      '2026-08-12', '2026-08-13', '2026-08-14'
    ];

    let totalUpdated = 0;

    for (const d of dates) {
      console.log(`Fetching data for ${d}...`);
      const params = new URLSearchParams();
      params.append('run_export', '1');
      params.append('query_date', d);
      params.append('end_date', d);
      params.append('campaign[]', '--ALL--');
      params.append('group[]', '--ALL--');
      params.append('header_row', 'Y');
      params.append('rec_fields', 'N');
      params.append('export_fields', 'STANDARD');
      params.append('SUBMIT', 'SUBMIT');

      statuses.forEach(s => params.append('status[]', s));

      const tsvData = await fetchAdminPage('call_report_export.php', 'medicare', 'POST', params.toString());
      const lines = tsvData.split('\n');
      
      let updatedCount = 0;
      for (const line of lines) {
        const cols = line.split('\t');
        if (cols.length >= 10 && cols[0] && cols[0].trim().startsWith('20')) {
          const phone = cols[1] ? cols[1].trim() : '';
          const agentId = cols[3] ? cols[3].trim() : '';
          const agentName = cols[4] ? cols[4].trim() : '';
          
          if (phone && agentName && agentId) {
            const combinedAgent = `${agentName} (${agentId})`;
            
            const res = await query(
              `UPDATE dialer_sales_history 
               SET agent = $1 
               WHERE dialer = 'medicare' 
                 AND phone = $2 
                 AND agent != $1`,
              [combinedAgent, phone]
            );
            
            if (res.rowCount > 0) {
              updatedCount += res.rowCount;
              totalUpdated += res.rowCount;
            }
          }
        }
      }
      console.log(`Updated ${updatedCount} records for ${d}`);
    }
    
    console.log(`Total successfully updated: ${totalUpdated}`);

  } catch (err) {
    console.error('Error fixing agent names:', err);
  }
  process.exit(0);
}

fixAgentNames();
