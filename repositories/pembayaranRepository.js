const db = require('../db');

async function listRegisters({ stkid, search = '', page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const q = `%${String(search).trim()}%`;

  const rows = await db.query(
    `
    SELECT
      k.registerno,
      k.kirim,
      k.alamat,
      k.namakirim,
      k.kelurahan,
      k.kecamatan,
      k.wilayah,
      k.kota,
      k.kodepos,
      k.bayar,
      k.ongkir,
      k.createdt
    FROM public.tr_kirim k
    WHERE k.stkid = $1
      AND (k.registerno ILIKE $2
       OR COALESCE(k.namakirim, '') ILIKE $2
       OR COALESCE(k.kota, '') ILIKE $2
       OR COALESCE(k.alamat, '') ILIKE $2)
    ORDER BY k.createdt DESC NULLS LAST, k.registerno DESC
    LIMIT $3 OFFSET $4
    `,
    [stkid, q, limit, offset]
  );

  const count = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM public.tr_kirim k
    WHERE k.stkid=$1 AND (k.registerno ILIKE $2
       OR COALESCE(k.namakirim, '') ILIKE $2
       OR COALESCE(k.kota, '') ILIKE $2
       OR COALESCE(k.alamat, '') ILIKE $2)
    `,
    [stkid, q]
  );

  return { rows, total: count[0]?.total || 0, page, limit };
}

async function getRegister(client, registerno, stkid) {
  const header = await client.query(
    `
    SELECT
      registerno, kirim, alamat, kelurahan, kecamatan, wilayah, kota,
      kodepos, bayar, ongkir, stkid, createdt, updatedt, createnm,
      updatenm, namakirim
    FROM public.tr_kirim
    WHERE registerno = $1 AND stkid = $2
    `,
    [registerno, stkid]
  );

  if (!header.rows[0]) return null;

  const transactions = await client.query(
    `
    SELECT
      r.orderno,
      r.nama,
      r.usernamesp,
      r.createdt,
      r.stbayar,
      COALESCE(SUM(d.qty * d.dp), 0)::numeric(18,2) AS total_harga,
      COALESCE(SUM(d.qty * d.pin), 0)::numeric(18,2) AS total_pin,
      COALESCE(SUM(d.qty * d.bv), 0)::numeric(18,2) AS total_bv
    FROM public.tr_pinreg r
    LEFT JOIN public.tr_pinregdet d ON d.orderno = r.orderno
    WHERE r.registerno = $1 and r.stkid = $2
    GROUP BY r.orderno, r.nama, r.usernamesp, r.createdt, r.stbayar
    ORDER BY r.createdt DESC NULLS LAST, r.orderno DESC
    `,
    [registerno, stkid]
  );

  const payments = await client.query(
    `
    SELECT
      b.registerno,
      b.paytype,
      p.deskripsi,
      b.amount,
      b.catatan
    FROM public.tr_bayar b
    LEFT JOIN public.payment p ON p.paytype = b.paytype
    WHERE b.registerno = $1
    ORDER BY b.paytype
    `,
    [registerno]
  );

  return {
    header: header.rows[0],
    transactions: transactions.rows,
    payments: payments.rows,
  };
}

async function listUnpaidTransactions(
  stkid,
  { search = '', page = 1, limit = 20 }
) {
  const offset = (page - 1) * limit;
  const q = `%${String(search).trim()}%`;

  const rows = await db.query(
    `
    SELECT
      r.orderno,
      r.nama,
      r.usernamesp,
      r.createdt,
      r.stbayar,
      COALESCE(SUM(d.qty * d.dp), 0)::numeric(18,2) AS total_harga,
      COALESCE(SUM(d.qty * d.pin), 0)::numeric(18,2) AS total_pin,
      COALESCE(SUM(d.qty * d.bv), 0)::numeric(18,2) AS total_bv
    FROM public.tr_pinreg r
    LEFT JOIN public.tr_pinregdet d ON d.orderno = r.orderno
    WHERE r.stkid = $1 AND r.stbayar = false
    AND (
      r.orderno ILIKE $2
       OR COALESCE(r.nama, '') ILIKE $2
       OR COALESCE(r.usernamesp, '') ILIKE $2
       )
    GROUP BY r.orderno, r.nama, r.usernamesp, r.createdt, r.stbayar
    ORDER BY r.createdt DESC NULLS LAST, r.orderno DESC
    LIMIT $3 OFFSET $4
    `,
    [stkid, q, limit, offset]
  );

  const count = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM public.tr_pinreg r
    WHERE r.stkid = $1 AND r.stbayar = false
      AND (r.orderno ILIKE $2
       OR COALESCE(r.nama, '') ILIKE $2
       OR COALESCE(r.usernamesp, '') ILIKE $2)
    `,
    [stkid, q]
  );

  return { rows, total: count[0]?.total || 0, page, limit };
}

async function listPayments() {
  return db.query(
    `
    SELECT paytype, deskripsi
    FROM public.payment
    ORDER BY paytype
    `
  );
}

async function generateRegisterNo(client) {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext('pembayaran_registerno'))`
  );

  const yy = String(new Date().getFullYear()).slice(-2);
  const result = await client.query(
    `
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(registerno FROM 4) AS INTEGER)), 0
    ) AS max_no
    FROM public.tr_kirim
    WHERE registerno ~ $1
    `,
    [`^R${yy}[0-9]+$`]
  );

  const next = Number(result.rows[0]?.max_no || 0) + 1;
  return `R${yy}${String(next).padStart(5, '0')}`;
}

async function lockAndGetSelectedTransactions(client, ordernos, stkid) {
  return client.query(
    `
    SELECT orderno, nama, stbayar, registerno
    FROM public.tr_pinreg
    WHERE orderno = ANY($1::varchar[]) AND stkid = $2
    ORDER BY orderno
    FOR UPDATE
    `,
    [ordernos, stkid]
  );
}

//async function calculateGoodsTotal(client, ordernos) {
//  const result = await client.query(
//    `
//    SELECT COALESCE(SUM(d.qty * d.dp), 0)::numeric(18,2) AS total_barang
//    FROM public.tr_pinregdet d
//    WHERE d.orderno = ANY($1::varchar[])
//    `,
//    [ordernos]
//  );
//  return result.rows[0]?.total_barang || '0.00';
//}

async function calculateGoodsTotal(client, ordernos) {
  const result = await client.query(
    `
    SELECT
      COALESCE(SUM(d.qty * d.dp), 0)::numeric(18,2) AS total_amount,
      COALESCE(SUM(d.qty * d.pin), 0)::integer AS total_pin
    FROM public.tr_pinregdet d
    WHERE d.orderno = ANY($1::varchar[])
    `,
    [ordernos]
  );

  return {
    total_amount: result.rows[0]?.total_amount || '0.00',
    total_pin: result.rows[0]?.total_pin || 0,
  };
}

async function validatePaymentTypes(client, paytypes) {
  return client.query(
    `
    SELECT paytype, deskripsi
    FROM public.payment
    WHERE paytype = ANY($1::varchar[])
    `,
    [paytypes]
  );
}

async function insertRegister(client, data) {
  const result = await client.query(
    `
    INSERT INTO public.tr_kirim
      (registerno, kirim, alamat, kelurahan, kecamatan, wilayah, kota,
       kodepos, bayar, ongkir, stkid, createdt, updatedt, createnm,
       updatenm, namakirim, tamount, tpin)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7,
       $8, $9::numeric, $10::numeric, $11, NOW(), NOW(), $12, $12, $13,$14,$15::integer)
    RETURNING *
    `,
    [
      data.registerno,
      data.kirim,
      data.alamat,
      data.kelurahan,
      data.kecamatan,
      data.wilayah,
      data.kota,
      data.kodepos,
      data.bayar,
      data.ongkir,
      data.stkid,
      data.username,
      data.namakirim,
      data.tamount,
      data.tpin,
    ]
  );
  return result.rows[0];
}

async function insertPayment(client, registerno, payment) {
  await client.query(
    `
    INSERT INTO public.tr_bayar (registerno, paytype, amount, catatan)
    VALUES ($1, $2, $3::numeric, $4)
    `,
    [registerno, payment.paytype, payment.amount, payment.catatan]
  );
}

async function paymentTotal(client, registerno) {
  const result = await client.query(
    `
    SELECT COALESCE(SUM(amount), 0)::numeric(18,2) AS total_bayar
    FROM public.tr_bayar
    WHERE registerno = $1
    `,
    [registerno]
  );
  return result.rows[0]?.total_bayar || '0.00';
}

async function markTransactionsPaid(
  client,
  ordernos,
  registerno,
  username,
  stkid
) {
  return client.query(
    `
    UPDATE public.tr_pinreg
SET stbayar = true,
    registerno = $1,
    updatedt = NOW(),
    updatenm = $2
WHERE orderno = ANY($3::varchar[])
  AND stkid = $4
  AND stbayar = false
RETURNING orderno
    `,
    [registerno, username, ordernos, stkid]
  );
}

async function deleteRegister(client, registerno) {
  await client.query(`DELETE FROM public.tr_bayar WHERE registerno = $1`, [
    registerno,
  ]);

  await client.query(
    `
    UPDATE public.tr_pinreg
    SET stbayar = false,
        registerno = NULL
    WHERE registerno = $1
      AND stkid = $2
    `,
    [registerno, stkid]
  );

  const result = await client.query(
    `DELETE FROM public.tr_kirim WHERE registerno = $1 AND stkid = $2 RETURNING registerno`,
    [registerno, stkid]
  );

  return result.rowCount;
}

module.exports = {
  listRegisters,
  getRegister,
  listUnpaidTransactions,
  listPayments,
  generateRegisterNo,
  lockAndGetSelectedTransactions,
  calculateGoodsTotal,
  validatePaymentTypes,
  insertRegister,
  insertPayment,
  paymentTotal,
  markTransactionsPaid,
  deleteRegister,
};
