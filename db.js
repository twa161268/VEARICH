require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL2,

  ssl: {
    rejectUnauthorized: false,
  },

  // Batasi koneksi agar tidak menghabiskan
  // connection pool Supabase
  max: 5,

  // Jangan terlalu lama menunggu koneksi idle
  idleTimeoutMillis: 30000,

  // Batasi waktu menunggu koneksi
  connectionTimeoutMillis: 20000,
});

pool.on('connect', () => {
  console.log('DB: koneksi baru dibuat');
});

pool.on('acquire', () => {
  console.log(
    `DB: connection acquired | total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`
  );
});

pool.on('remove', () => {
  console.log('DB: koneksi dilepas');
});

pool.on('error', (err) => {
  console.error('DB POOL ERROR:', err.message);
});

async function query(sql, params = []) {
  const start = Date.now();

  try {
    const result = await pool.query(sql, params);

    const ms = Date.now() - start;

    if (ms > 500) {
      console.log(`🐢 DB QUERY LAMBAT: ${ms} ms`);
      console.log(sql);
    }

    return result.rows;
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`❌ DB ERROR setelah ${ms} ms:`, err.message);
    throw err;
  }
}

module.exports = {
  query,
  pool,
};
