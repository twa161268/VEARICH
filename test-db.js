require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL2,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 1,
  connectionTimeoutMillis: 20000,
});

async function test() {
  console.log('=== TEST DATABASE ===');

  let client;

  try {
    // 1. Ukur membuat/mendapatkan connection
    let start = Date.now();

    client = await pool.connect();

    console.log(`CONNECT : ${Date.now() - start} ms`);

    // 2. SELECT 1
    start = Date.now();

    await client.query('SELECT 1');

    console.log(`SELECT 1 : ${Date.now() - start} ms`);

    // 3. master_stk
    start = Date.now();

    const result = await client.query(`
      SELECT stkid, namastk
      FROM master_stk
      ORDER BY stkid
    `);

    console.log(
      `MASTER_STK : ${Date.now() - start} ms (${result.rowCount} rows)`
    );

    // 4. Jalankan SELECT 1 beberapa kali
    console.log('\n--- TEST BERULANG ---');

    for (let i = 1; i <= 10; i++) {
      start = Date.now();

      await client.query('SELECT 1');

      console.log(`SELECT 1 #${i} : ${Date.now() - start} ms`);
    }
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    if (client) client.release();

    await pool.end();
  }
}

test();
