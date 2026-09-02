const { Client } = require('pg');
const client = new Client({ user: 'postgres', password: '123443', host: 'localhost', database: 'bpo_qa_system' });
client.connect().then(async () => {
  // Update call_leads campaign_id from 10 (Medicare Dialer) to 6 (Medicare)
  const updateRes = await client.query("UPDATE call_leads SET campaign_id = 6, campaign_name = 'Medicare' WHERE campaign_id = 10");
  console.log("Updated call_leads:", updateRes.rowCount);
  
  // Optionally update any Pharmacy ones if they exist (Pharmacy is 9)
  // Assuming Pharmacy Dialer would be ID 11 if it exists, let's just find and update any name ending in ' Dialer'
  const campaigns = await client.query("SELECT id, name FROM campaigns WHERE name LIKE '% Dialer'");
  for (const c of campaigns.rows) {
     const realName = c.name.replace(' Dialer', '');
     const realCamp = await client.query("SELECT id FROM campaigns WHERE name = $1", [realName]);
     if(realCamp.rows.length > 0) {
        const res = await client.query("UPDATE call_leads SET campaign_id = $1, campaign_name = $2 WHERE campaign_id = $3", [realCamp.rows[0].id, realName, c.id]);
        console.log(`Merged ${c.name} into ${realName}, updated rows: ${res.rowCount}`);
     }
  }

  // Delete the auto-generated campaign
  await client.query("DELETE FROM campaigns WHERE name LIKE '% Dialer'");
  
  client.end();
}).catch(console.error);
