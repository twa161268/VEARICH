const db = require('../db');
const repo = require('../repositories/pinregRepository');

//const PRICE_CODE = '2601';

function validationErrors(body, pricecode) {
  const errors = [];
  if (!body || !String(body.nama || '').trim())
    errors.push('Nama wajib diisi.');
  if (!Array.isArray(body?.details) || body.details.length === 0) {
    errors.push('Minimal satu produk harus dipilih.');
    return errors;
  }

  const seen = new Set();
  body.details.forEach((d, i) => {
    const row = i + 1;
    const prdid = String(d.prdid || '').trim();
    const qty = Number(d.qty);
    if (!prdid) errors.push(`Baris ${row}: produk wajib dipilih.`);
    if (!Number.isInteger(qty) || qty <= 0)
      errors.push(`Baris ${row}: qty harus integer positif.`);
    const key = `${prdid}|${pricecode}`;
    if (seen.has(key))
      errors.push(
        `Baris ${row}: produk yang sama tidak boleh dipilih dua kali.`
      );
    seen.add(key);
  });
  return errors;
}

function throwValidation(errors) {
  if (errors.length) {
    const err = new Error(errors.join(' '));
    err.status = 422;
    throw err;
  }
}

async function nextOrderNo(client) {
  // Lock hanya berlaku selama transaksi database ini.
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext('pinreg_orderno'))`
  );
  const yy = String(new Date().getFullYear()).slice(-2);
  const result = await client.query(
    `
    SELECT COALESCE(MAX(CAST(SUBSTRING(orderno FROM 3) AS INTEGER)), 0) AS max_no
    FROM tr_pinreg
    WHERE orderno ~ $1
  `,
    [`^${yy}[0-9]+$`]
  );
  return `${yy}${String(Number(result.rows[0].max_no) + 1).padStart(4, '0')}`;
}

async function nextTransId(client) {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext('pinreg_transid'))`
  );
  const result = await client.query(
    `SELECT COALESCE(MAX(transid), 0) AS max_id FROM tr_pinreg`
  );
  return Number(result.rows[0].max_id) + 1;
}

async function insertDetail(client, orderno, detail, pricecode) {
  const price = await repo.getPrice(client, detail.prdid, pricecode);
  if (!price) {
    const err = new Error(
      `Produk ${detail.prdid} dengan pricecode ${pricecode} tidak ditemukan atau tidak aktif.`
    );
    err.status = 422;
    throw err;
  }

  await client.query(
    `
    INSERT INTO tr_pinregdet (orderno, prdid, pricecode, qty, dp, bv, pin)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `,
    [
      orderno,
      detail.prdid,
      pricecode,
      Number(detail.qty),
      price.dp,
      price.bv,
      price.pin,
    ]
  );
}

async function create(body, actor) {
  throwValidation(validationErrors(body, actor.pricecode));
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const orderno = await nextOrderNo(client);
    const transid = await nextTransId(client);

    await client.query(
      `
      INSERT INTO tr_pinreg
        (transid, nama, nohp, usernamesp, namasp, orderno,
         createdt, createnm, registerno, stkid)
      VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9)
    `,
      [
        transid,
        String(body.nama).trim(),
        body.nohp || null,
        body.usernamesp || null,
        body.namasp || null,
        orderno,
        actor.username,
        null, // karena registerno belum dibuatkan, nanti saja pas update
        actor.stkid, //body.stkid || actor.stkid || null,
      ]
    );

    for (const detail of body.details) {
      await insertDetail(client, orderno, detail, actor.pricecode);
    }

    await client.query('COMMIT');
    return getByOrderNo(orderno, actor.stkid);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      err.status = 409;
      err.message =
        'Nomor transaksi sudah digunakan. Silakan ulangi penyimpanan.';
    }
    throw err;
  } finally {
    client.release();
  }
}

async function update(orderno, body, actor) {
  throwValidation(validationErrors(body, actor.pricecode));
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    //const existing = await repo.findByOrderNo(client, orderno);

    const existing = await repo.findByOrderNo(client, orderno, actor.stkid);

    if (!existing) {
      const err = new Error('Transaksi tidak ditemukan.');
      err.status = 404;
      throw err;
    }

    await client.query(
      `
  UPDATE tr_pinreg
  SET nama=$2,
      nohp=$3,
      usernamesp=$4,
      namasp=$5,
      registerno=$6,
      updatedt=NOW(),
      updatenm=$7
  WHERE orderno=$1
    AND stkid=$8
`,
      [
        orderno,
        String(body.nama).trim(),
        body.nohp || null,
        body.usernamesp || null,
        body.namasp || null,
        body.registerno || null,
        actor.username,
        actor.stkid,
      ]
    );

    await client.query('DELETE FROM tr_pinregdet WHERE orderno=$1', [orderno]);
    for (const detail of body.details)
      await insertDetail(client, orderno, detail, actor.pricecode);

    await client.query('COMMIT');
    return getByOrderNo(orderno, actor.stkid);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getByOrderNo(orderno, stkid) {
  const client = await db.pool.connect();
  try {
    return await repo.findByOrderNo(client, orderno, stkid);
  } finally {
    client.release();
  }
}

async function remove(orderno, stkid) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await repo.findByOrderNo(client, orderno, stkid);

    if (!existing) {
      const err = new Error('Transaksi tidak ditemukan.');
      err.status = 404;
      throw err;
    }

    await client.query(
      `
      DELETE FROM tr_pinregdet
      WHERE orderno=$1
      `,
      [orderno]
    );

    await client.query(
      `
      DELETE FROM tr_pinreg
      WHERE orderno=$1
        AND stkid=$2
      `,
      [orderno, stkid]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  list: repo.list,
  getByOrderNo,
  create,
  update,
  remove,
  listProducts: repo.listProducts,
  listPrices: repo.listPrices,
};
