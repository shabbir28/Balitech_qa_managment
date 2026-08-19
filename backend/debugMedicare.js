const { getSales } = require('./src/controllers/dialerSalesController');
const { fetchAdminPage } = require('./src/controllers/dialerController');
require('dotenv').config();

async function debugMedicare() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const now = new Date();
    const todayStr = formatter.format(now);
    
    console.log("Checking for date:", todayStr);

    try {
        const sysHtml = await fetchAdminPage('admin.php?ADD=321111111111111', 'medicare');
        console.log("System statuses fetched, length:", sysHtml.length);
        
        const req = { query: { dialer: 'medicare', timeFilter: 'TODAY' } };
        let output = null;
        const res = { 
            json: (data) => { output = data; }, 
            status: (code) => ({ json: (data) => { output = data; } })
        };
        await getSales(req, res);
        
        if (output && output.data) {
            console.log(`Total leads returned for TODAY: ${output.data.length}`);
            const statusesCount = {};
            output.data.forEach(l => {
                statusesCount[l.status] = (statusesCount[l.status] || 0) + 1;
            });
            console.log("Status breakdown:", statusesCount);
        } else {
            console.log("No data returned", output);
        }

        // Also check MONTH
        const reqMonth = { query: { dialer: 'medicare', timeFilter: 'MONTH' } };
        const resMonth = { 
            json: (data) => { output = data; }, 
            status: (code) => ({ json: (data) => { output = data; } })
        };
        await getSales(reqMonth, resMonth);
        
        if (output && output.data) {
            console.log(`Total leads returned for MONTH: ${output.data.length}`);
            const statusesCount = {};
            output.data.forEach(l => {
                statusesCount[l.status] = (statusesCount[l.status] || 0) + 1;
            });
            console.log("Status breakdown for MONTH:", statusesCount);
        }
    } catch(e) {
        console.error(e);
    }
}

debugMedicare();
