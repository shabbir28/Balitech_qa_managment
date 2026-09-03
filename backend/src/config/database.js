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

const isProduction = (process.env.NODE_ENV || 'production') === 'production';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'bpo_qa_system',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,                        // max pool connections
  min: 2,                         // keep minimum connections alive
  idleTimeoutMillis: 30000,       // close idle connections after 30s
  connectionTimeoutMillis: 5000,  // wait 5s before timing out connection attempt
  acquireTimeoutMillis: 10000,    // wait 10s to acquire a client from pool
  // Enable SSL in production environments
  ssl: isProduction && process.env.DB_SSL !== 'false'
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('connect', (client) => {
  if (!isProduction) {
    console.log('✅ Database connected successfully');
  }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err.message);
});

/**
 * Query helper with parameterized queries for SQL injection protection
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (!isProduction) {
      // Only log slow queries in development to avoid log flooding
      if (duration > 100) {
        console.log('Slow query detected', { text: text.substring(0, 80), duration, rows: res.rowCount });
      }
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
};

const getClient = async () => {
  return await pool.connect();
};

module.exports = { pool, query, getClient };
