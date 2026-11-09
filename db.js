require('dotenv').config();

const { Pool } = require('pg');

// Gunakan Supabase Transaction Pooler (port 6543) untuk aplikasi yang dapat
// menjalankan banyak request/instance. Ambil URI lengkap dari Supabase:
// Project Settings > Database > Connection string > Transaction pooler.
// Jangan menaruh kredensial database di source code.
const connectionString = process.env.DATABASE_URL2 || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL2 atau DATABASE_URL wajib diisi.');
}

const poolMax = Math.max(1, Math.min(10, Number(process.env.DB_POOL_MAX) || 3));

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  // Default 3 per proses agar beberapa instance tidak cepat menghabiskan
  // batas client Supabase. Bisa disetel melalui environment DB_POOL_MAX.
  max: poolMax,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  // Daur ulang koneksi setelah sejumlah penggunaan untuk mengurangi
  // koneksi lama yang tertahan pada proses yang berjalan lama.
  maxUses: 7500,
});

pool.on('error', (err) => {
  console.error('DB POOL IDLE CLIENT ERROR:', err.message);
});

// Log ringkas ketika pool mulai antre/penuh; tidak mencetak password/URI.
let lastPoolWarning = 0;
function logPoolState() {
  if (pool.waitingCount > 0) {
    const now = Date.now();
    if (now - lastPoolWarning > 10000) {
      lastPoolWarning = now;
      console.warn(
        `DB POOL WAITING | total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount} max=${poolMax}`
      );
    }
  }
}

async function query(sql, params = []) {
  const totalStart = Date.now();
  let client;

  try {
    const acquireStart = Date.now();
    client = await pool.connect();
    const acquireMs = Date.now() - acquireStart;

    const queryStart = Date.now();
    const result = await client.query(sql, params);
    const queryMs = Date.now() - queryStart;
    const totalMs = Date.now() - totalStart;

    logPoolState();
    if (totalMs > 1000) {
      console.warn(
        `DB QUERY LAMBAT | acquire=${acquireMs}ms | sql=${queryMs}ms | total=${totalMs}ms | totalConn=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`
      );
    }
    return result.rows;
  } catch (err) {
    console.error(`DB ERROR setelah ${Date.now() - totalStart} ms:`, err.message);
    throw err;
  } finally {
    if (client) client.release();
    logPoolState();
  }
}

module.exports = { query, pool };
