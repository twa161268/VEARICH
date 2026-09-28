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

// buat Test Saja //
//pool.on('connect', () => {
//  console.log('DB: koneksi baru dibuat');
//});

//pool.on('acquire', () => {
//  console.log(
//    `DB: connection acquired | total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`
//  );
//});

//pool.on('remove', () => {
//  console.log('DB: koneksi dilepas');
//});

//pool.on('error', (err) => {
//  console.error('DB POOL ERROR:', err.message);
//});

async function query(sql, params = []) {
  const totalStart = Date.now();

  let client;

  try {
    // Waktu untuk mendapatkan connection dari pool
    const acquireStart = Date.now();

    client = await pool.connect();

    const acquireMs = Date.now() - acquireStart;

    // Waktu khusus eksekusi SQL
    const queryStart = Date.now();

    const result = await client.query(sql, params);

    const queryMs = Date.now() - queryStart;
    const totalMs = Date.now() - totalStart;

    // Tampilkan kalau cukup lambat
    if (totalMs > 500) {
      console.log(
        `🐢 DB QUERY | acquire=${acquireMs}ms | sql=${queryMs}ms | total=${totalMs}ms`
      );
      console.log(sql);
    }

    return result.rows;
  } catch (err) {
    const totalMs = Date.now() - totalStart;

    console.error(`❌ DB ERROR setelah ${totalMs} ms:`, err.message);

    throw err;
  } finally {
    // Pastikan connection selalu dikembalikan ke pool
    if (client) {
      client.release();
    }
  }
}

module.exports = {
  query,
  pool,
};
