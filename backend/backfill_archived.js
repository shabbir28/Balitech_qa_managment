const { query } = require('./src/config/database');
const { fetchAdminPage } = require('./src/controllers/dialerController');
const fs = require('fs');

const datesToBackfill = [
  '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04',
  '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08',
  '2026-08-09', '2026-08-10', '2026-08-11'
];

const dialers = [
  { type: 'medicare', statuses: ['D2', 'D3', 'D4', 'D5', 'DSB', 'D1', 'HIB', 'HIMAIN'] },
  
];

async function backfill() {
  console.log('Starting Backfill...');

  for (const dateStr of datesToBackfill) {
    for (const dialer of dialers) {
      console.log(`Fetching ${dialer.type} for ${dateStr} from Archive...`);
      let allLeads = [];

      try {
        const params = new URLSearchParams();
        params.append('run_export', '1');
        params.append('query_date', dateStr);
        params.append('end_date', dateStr);
        params.append('campaign[]', '--ALL--');
        params.append('group[]', '--ALL--');
        params.append('header_row', 'Y');
        params.append('rec_fields', 'N');
        params.append('export_fields', 'STANDARD');
        params.append('search_archived_data', 'checked'); // ARCHIVE DATA FLAG
        params.append('SUBMIT', 'SUBMIT');

        dialer.statuses.forEach(s => params.append('status[]', s));

        const tsvData = await fetchAdminPage('call_report_export.php', dialer.type, 'POST', params.toString());
        
        if (tsvData.includes('You do not have permissions for export reports')) {
          console.error(`Export permissions missing for ${dialer.type}`);
          continue;
        }

        const lines = tsvData.split('\n');
        for (const line of lines) {
          const cols = line.split('\t');
          if (cols.length >= 10 && cols[0] && cols[0].trim().startsWith('20')) {
            const parsedLeadId = cols.length > 35 ? (cols[35] ? cols[35].trim() : '') : (cols[cols.length - 1] ? cols[cols.length - 1].trim() : '');
            allLeads.push({
              last_call: cols[0].trim(),
              phone: cols[1] ? cols[1].trim() : '',
              status: cols[2] ? cols[2].trim() : '',
              last_agent: cols[4] ? cols[4].trim() : '',
              team: cols.length > 31 ? (cols[31] ? cols[31].trim() : '') : '',
              name: cols.length > 13 ? (cols[13] ? cols[13].trim() : '') : '',
              lead_id: parsedLeadId
            });
          }
        }

        // Deduplicate
        const uniqueMap = new Map();
        allLeads.forEach(l => {
          if (l.lead_id) {
            uniqueMap.set(l.lead_id, l);
          } else {
            uniqueMap.set(`${l.phone}_${l.last_call}`, l);
          }
        });
        const uniqueLeads = Array.from(uniqueMap.values());
        
        console.log(`Found ${uniqueLeads.length} unique sales for ${dialer.type} on ${dateStr}`);

        // Insert to DB
        if (uniqueLeads.length > 0) {
          const CHUNK_SIZE = 1000;
          for (let i = 0; i < uniqueLeads.length; i += CHUNK_SIZE) {
            const chunk = uniqueLeads.slice(i, i + CHUNK_SIZE);
            const values = [];
            const placeholders = [];
            
            chunk.forEach((l, index) => {
              const p = index * 7;
              placeholders.push(`($${p+1}, $${p+2}, $${p+3}, $${p+4}, $${p+5}, $${p+6}, $${p+7})`);
              
              let saleDate = dateStr;
              if (l.last_call && l.last_call.length >= 10) {
                saleDate = l.last_call.substring(0, 10);
              }
              
              values.push(
                l.lead_id,
                l.phone || null,
                l.status || null,
                l.last_agent || null,
                saleDate,
                dialer.type,
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
            
            await query(sql, values);
          }
          console.log(`Successfully saved ${uniqueLeads.length} rows to DB!`);
        }

      } catch (err) {
        console.error(`Error processing ${dialer.type} on ${dateStr}:`, err.message);
      }
    }
  }

  console.log('Backfill fully completed!');
  process.exit(0);
}

backfill();
