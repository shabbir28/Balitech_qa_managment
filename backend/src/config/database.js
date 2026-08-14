const { Pool, types } = require('pg');
require('dotenv').config();

// Fix PostgreSQL DATE parsing timezone issue globally
// OID 1082 is for PostgreSQL DATE type
types.setTypeParser(1082, function(stringValue) {
  return stringValue; // Returns YYYY-MM-DD string exactly as in DB instead of converting to local Date object
});

if (!process.env.DB_PASSWORD) {
  console.error('❌ DB_PASSWORD is not set. Configure it in your .env file before starting the server.');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'bpo_qa_system',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

/**
 * Query helper with parameterized queries for SQL injection protection
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

const getClient = async () => {
  return await pool.connect();
};

module.exports = { pool, query, getClient };
