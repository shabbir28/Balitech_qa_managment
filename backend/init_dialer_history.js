const { query } = require('./src/config/database');

async function createTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS dialer_sales_history (
        id SERIAL PRIMARY KEY,
        lead_id VARCHAR(50) NOT NULL,
        phone VARCHAR(20),
        status VARCHAR(50),
        agent VARCHAR(100),
        sale_date DATE NOT NULL,
        dialer VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (lead_id, dialer)
      );
    `);
    console.log('Table created successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

createTable();
