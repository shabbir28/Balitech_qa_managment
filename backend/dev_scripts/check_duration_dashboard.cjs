const assert = require('node:assert/strict');
const { laRecording: classify, durationBucket } = require('../src/utils/laRecordings');
const presets = Object.fromEntries(['8777292189','3213420436','8662277401','8664826418','8662474114','8662260636','8776595235'].map(did => [did, {name: 'Test transfer', retiredOn: null}]));
const laRecording = recording => classify(recording, presets);
const rec = (seconds, suffix = '8664826418', date = '2026-10-20 12:00:00', id = String(seconds)) => ({
  filename: `20261020_7001_941621${suffix}.mp3`, location: `http://recordings.example/${id}.mp3`,
  date, length: String(seconds), recid: id,
});
for (const did of Object.keys(presets)) assert.equal(laRecording(rec(900, did)).did, did);
assert.equal(laRecording(rec(2000, '9197501160')), null); // Agent side, even if long
assert.equal(laRecording({ ...rec(900), filename: '8664826418_agent.mp3' }), null);
assert.equal(laRecording({ ...rec(900), length: '' }), null);
assert.equal(laRecording({ ...rec(900), date: '' }), null);
for (const [seconds, bucket] of [[799,null],[800,'800'],[999,'800'],[1000,'1000'],[1499,'1000'],[1500,'1500'],[9000,'1500']]) {
  assert.equal(durationBucket(seconds), bucket);
}
const db = require('../src/config/database');
(async () => {
 const client = await db.pool.connect();
 try {
  await client.query('BEGIN');
  await client.query('CREATE TEMP TABLE dialer_sales_history (id serial, lead_id text, dialer text, phone text, agent text, sale_date date, qa_status text) ON COMMIT DROP');
  await client.query('CREATE TEMP TABLE dashboard_la_recordings (dialer text, lead_id text, recordings jsonb, checked_at timestamptz, cache_version integer DEFAULT 2) ON COMMIT DROP');
  await client.query('CREATE TEMP TABLE dashboard_dialer_presets (dialer text, presets jsonb, checked_at timestamptz) ON COMMIT DROP');
  await client.query("INSERT INTO dashboard_dialer_presets VALUES ('medicare',$1::jsonb,NOW()),('pharmacy',$1::jsonb,NOW())", [JSON.stringify(presets)]);
  await client.query(`INSERT INTO dialer_sales_history (lead_id,dialer,sale_date) VALUES
   ('123','medicare','2026-10-20'), ('123_1','medicare','2026-10-20'),
   ('456','pharmacy','2026-10-20'), ('789','medicare','2026-10-19')`);
  const records = [799,800,999,1000,1499,1500,9000].map(n => rec(n));
  records.push(rec(2000,'9197501160'),rec(2001,'8664826418','2026-10-19 12:00:00'),rec(800));
  await client.query(`INSERT INTO dashboard_la_recordings (dialer,lead_id,recordings,checked_at) VALUES
    ('medicare','123',$1::jsonb,NOW()), ('pharmacy','456',$2::jsonb,NOW()), ('medicare','789',$2::jsonb,NOW())`,
    [JSON.stringify(records),JSON.stringify([rec(1800)])]);
  db.query = (sql,params) => client.query(sql,params);
  const {getDurationSales} = require('../src/controllers/durationDashboardController');
  async function request(extra={}, user={role:'Manager'}) {
   let body, status=200;
   await getDurationSales({query:{startDate:'2026-10-20',endDate:'2026-10-20',dialer:'medicare',...extra},user},
    {status(code){status=code;return this},json(value){body=value}}, e=>{throw e});
   return {status,body};
  }
  assert.deepEqual((await request()).body.data, {'800':2,'1000':2,'1500':2,known:1,pending:0,failed:0,totalLeads:1,didReady:true,didRefreshing:false,didSyncFailed:false});
  const seen = new Set();
  for (const threshold of ['800','1000','1500']) {
   const result=(await request({minDuration:threshold})).body;
   assert.equal(result.total,2);
   for (const row of result.data) {
     assert.equal(durationBucket(row.call_duration_seconds),threshold);
     assert.equal(row.did,'8664826418');
     assert.ok(!seen.has(row.id)); seen.add(row.id);
   }
  }
  assert.equal((await request({dialer:'all'})).body.data['1500'],3);
  assert.equal((await request({minDuration:'1500',page:'2'})).body.page,1);
  assert.equal((await request({page:'Infinity'})).status,400);
  assert.equal((await request({page:'-1'})).status,400);
  assert.equal((await request({startDate:'2026-02-30'})).status,400);
  assert.equal((await request({startDate:'2026-13-01'})).status,400);
  assert.equal((await request({minDuration:'-1'})).status,400);
  assert.equal((await request({}, {role:'QA Agent',campaign_name:'Pharmacy'})).status,403);
  assert.equal((await request({dialer:'all'},{role:'QA Agent',campaign_name:'Pharmacy'})).body.data['1500'],1);
  await client.query("UPDATE dashboard_dialer_presets SET presets = presets || $1::jsonb WHERE dialer='medicare'", [JSON.stringify({'9197501160': {name:'New transfer', retiredOn:null}})]);
  assert.equal((await request()).body.data['1500'],3); // Already-cached raw recording matches the new DID immediately.
  assert.equal((await request({dialer:'pharmacy'})).body.data['1500'],1);
  console.log('PASS: 7 DID suffixes, agent exclusion, exclusive boundaries, recording dates, repeat-sale/recording deduplication, detail counts, pagination, campaign access.');
 } finally { await client.query('ROLLBACK'); client.release(); await db.pool.end(); }
})().catch(e=>{console.error(e);process.exitCode=1});
