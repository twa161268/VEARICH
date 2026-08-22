// db.js
require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL2,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

module.exports = { query, pool };

