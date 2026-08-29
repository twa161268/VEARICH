const db = require('../db');

async function listRegisters({ stkid, search = '', page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const q = `%${String(search).trim()}%`;

  const rows = await db.query(
    `
    SELECT
      k.registerno,
      k.tpin,
      COALESCE(SUM(r.pin_terpakai), 0)::integer AS pin_terpakai,
      (
        COALESCE(k.tpin, 0) - COALESCE(SUM(r.pin_terpakai), 0)
      )::integer AS pin_sisa,
      k.namakirim,
      k.stkid,
      k.createdt
    FROM public.tr_kirim k
    LEFT JOIN public.tr_register r
      ON r.registerno = k.registerno
    WHERE k.stkid = $1 AND
    (k.registerno ILIKE $2
       OR COALESCE(k.namakirim, '') ILIKE $2)
    GROUP BY k.registerno, k.tpin, k.namakirim, k.stkid, k.createdt
    ORDER BY k.createdt DESC NULLS LAST, k.registerno DESC
    LIMIT $3 OFFSET $4
    `,
    [stkid, q, limit, offset]
  );

  const count = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM public.tr_kirim k
    WHERE k.stkid = $1 AND
    (k.registerno ILIKE $2
       OR COALESCE(k.namakirim, '') ILIKE $2)
    `,
    [stkid, q]
  );

  return {
    rows,
    total: count[0]?.total || 0,
    page,
    limit,
  };
}

async function getRegisterForUpdate(client, registerno, stkid) {
  const result = await client.query(
    `
    SELECT registerno, tpin, stkid, namakirim
    FROM public.tr_kirim
    WHERE registerno = $1 AND stkid = $2
    FOR UPDATE
    `,
    [registerno, stkid]
  );
  return result.rows[0] || null;
}

async function getRegister(registerno, stkid) {
  const result = await db.query(
    `
    SELECT
      k.registerno,
      k.tpin,
      k.stkid,
      k.namakirim,
      COALESCE(SUM(r.pin_terpakai), 0)::integer AS pin_terpakai,
      (
        COALESCE(k.tpin, 0) - COALESCE(SUM(r.pin_terpakai), 0)
      )::integer AS pin_sisa
    FROM public.tr_kirim k
    LEFT JOIN public.tr_register r
      ON r.registerno = k.registerno
    WHERE k.registerno = $1 AND k.stkid = $2
    GROUP BY k.registerno, k.tpin, k.stkid, k.namakirim
    `,
    [registerno, stkid]
  );
  return result[0] || null;
}

async function listRegistrations(registerno) {
  return db.query(
    `
    SELECT
      r.registerno,
      r.username,
      r.usernamesp,
      r.prdid,
      r.pricecode,
      r.keterangan,
      r.pin_terpakai,
      r.pin_sisa,
      r.createdt,
      r.createby,
      r.updatedt,
      r.updateby,
      p.prdname
    FROM public.tr_register r
    LEFT JOIN public.master_prd p
      ON p.prdid = r.prdid
    WHERE r.registerno = $1
    ORDER BY r.createdt ASC NULLS LAST, r.username
    `,
    [registerno]
  );
}

async function listProducts(pricecode, search = '') {
  const q = `%${String(search).trim()}%`;

  return db.query(
    `
    SELECT
      p.prdid,
      p.prdname,
      pt.pricecode,
      pt.pin
    FROM public.master_prd p
    JOIN public.pricetab pt
      ON pt.prdid = p.prdid
     AND pt.pricecode = $1
    WHERE COALESCE(p.status, TRUE) = TRUE
      AND (
        p.prdid ILIKE $2
        OR COALESCE(p.prdname, '') ILIKE $2
      )
    ORDER BY p.prdname NULLS LAST, p.prdid
    LIMIT 100
    `,
    [pricecode, q]
  );
}

async function getProduct(client, prdid, pricecode) {
  const result = await client.query(
    `
    SELECT
      p.prdid,
      p.prdname,
      pt.pricecode,
      pt.pin
    FROM public.master_prd p
    JOIN public.pricetab pt
      ON pt.prdid = p.prdid
     AND pt.pricecode = $2
    WHERE p.prdid = $1
      AND COALESCE(p.status, TRUE) = TRUE
    `,
    [prdid, pricecode]
  );
  return result.rows[0] || null;
}

async function getUsedPin(client, registerno) {
  const result = await client.query(
    `
    SELECT
      COALESCE(SUM(r.pin_terpakai), 0)::integer AS total
    FROM public.tr_register r
    WHERE r.registerno = $1
    `,
    [registerno]
  );
  return Number(result.rows[0]?.total || 0);
}

async function usernamesExist(client, usernames, registerno) {
  if (!usernames.length) return [];

  const result = await client.query(
    `
    SELECT username
    FROM public.tr_register
    WHERE registerno = $1
      AND username = ANY($2::varchar[])
    `,
    [registerno, usernames]
  );

  return result.rows.map((r) => r.username);
}

async function insertRegister(client, row) {
  const result = await client.query(
    `
    INSERT INTO public.tr_register
      (
        registerno,
        username,
        usernamesp,
        prdid,
        pricecode,
        keterangan,
        createdt,
        createby,
        updatedt,
        updateby,
        pin_terpakai,
        pin_sisa
      )
    VALUES
      ($1,$2,$3,$4,$5,$6,NOW(),$7,NOW(),$7,$8,$9)
    RETURNING *
    `,
    [
      row.registerno,
      row.username,
      row.usernamesp,
      row.prdid,
      row.pricecode,
      row.keterangan,
      row.actor,
      row.pin_terpakai,
      row.pin_sisa,
    ]
  );

  return result.rows[0];
}

async function updatePinSisa(client, registerno, pinSisa) {
  await client.query(
    `
    UPDATE public.tr_register
    SET pin_sisa = $2,
        updatedt = NOW()
    WHERE registerno = $1
    `,
    [registerno, pinSisa]
  );
}

module.exports = {
  listRegisters,
  getRegisterForUpdate,
  getRegister,
  listRegistrations,
  listProducts,
  getProduct,
  getUsedPin,
  usernamesExist,
  insertRegister,
  updatePinSisa,
};
