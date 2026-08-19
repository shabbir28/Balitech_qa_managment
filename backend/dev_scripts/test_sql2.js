const { pool } = require('./src/config/database');
async function test() {
  const client = await pool.connect();
  try {
    const cRes = await client.query('SELECT id, name FROM campaigns LIMIT 1');
    const uRes = await client.query('SELECT id FROM users LIMIT 2');
    const campId = cRes.rows[0]?.id;
    const userId = uRes.rows[0]?.id;
    console.log('campId:', campId, 'userId:', userId);

    await client.query('BEGIN');
    const leadValues = ['($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)'];
    const leadParams = [null, 'Manual Entry', 'AGT-MANUAL', 'ACA', campId, '555-0102', null, '', '', '', 'Manually assigned'];
    const leadRes = await client.query(`INSERT INTO call_leads (batch_id, agent_name, agent_id, campaign_name, campaign_id, customer_phone, call_date, call_duration, recording_url, disposition, notes) VALUES ${leadValues.join(', ')} RETURNING id`, leadParams);
    console.log('Lead Inserted:', leadRes.rows[0]);
    
    let assignValues = ['($1, $2, $3, $4, $5)'];
    let assignParams = [leadRes.rows[0].id, userId, userId, 'ACA', 'Manually assigned'];
    await client.query(`INSERT INTO lead_assignments (call_lead_id, assigned_to, assigned_by, campaign_name, notes) VALUES ${assignValues.join(', ')}`, assignParams);
    console.log('Assignment Inserted successfully!');
    
    await client.query('ROLLBACK');
  } catch(e) {
    console.error('ERROR:', e.message, e.detail);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    process.exit();
  }
}
test();
