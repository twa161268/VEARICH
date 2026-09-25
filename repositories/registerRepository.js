const db = require('../db');

async function listRegisters({ stkid = null, search = '', page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const q = `%${String(search).trim()}%`;
  const scope = stkid ? 'AND k.stkid = $1' : '';
  const params = stkid ? [stkid, q, limit, offset] : [q, limit, offset];
  const pSearch = stkid ? '$2' : '$1';
  const pLimit = stkid ? '$3' : '$2';
  const pOffset = stkid ? '$4' : '$3';

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
      ms.namastk,
      k.createdt
    FROM public.tr_kirim k
    LEFT JOIN public.tr_register r ON r.registerno = k.registerno
    LEFT JOIN public.master_stk ms ON ms.stkid = k.stkid
    WHERE 1=1 ${scope}
      AND (k.registerno ILIKE ${pSearch}
        OR COALESCE(k.namakirim, '') ILIKE ${pSearch}
        OR COALESCE(ms.namastk, '') ILIKE ${pSearch})
    GROUP BY k.registerno, k.tpin, k.namakirim, k.stkid, ms.namastk, k.createdt
    ORDER BY k.createdt DESC NULLS LAST, k.registerno DESC
    LIMIT ${pLimit} OFFSET ${pOffset}
    `,
    params
  );

  const countParams = stkid ? [stkid, q] : [q];
  const countSearch = stkid ? '$2' : '$1';
  const count = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM public.tr_kirim k
    LEFT JOIN public.master_stk ms ON ms.stkid = k.stkid
    WHERE 1=1 ${scope}
      AND (k.registerno ILIKE ${countSearch}
        OR COALESCE(k.namakirim, '') ILIKE ${countSearch}
        OR COALESCE(ms.namastk, '') ILIKE ${countSearch})
    `,
    countParams
  );

  return { rows, total: count[0]?.total || 0, page, limit };
}

async function getRegisterForUpdate(client, registerno, stkid = null) {
  const result = await client.query(
    `
    SELECT registerno, tpin, stkid, namakirim
    FROM public.tr_kirim
    WHERE registerno = $1
      ${stkid ? 'AND stkid = $2' : ''}
    FOR UPDATE
    `,
    stkid ? [registerno, stkid] : [registerno]
  );
  return result.rows[0] || null;
}

async function getRegister(registerno, stkid = null) {
  const result = await db.query(
    `
    SELECT
      k.registerno,
      k.tpin,
      k.stkid,
      ms.namastk,
      k.namakirim,
      COALESCE(SUM(r.pin_terpakai), 0)::integer AS pin_terpakai,
      (
        COALESCE(k.tpin, 0) - COALESCE(SUM(r.pin_terpakai), 0)
      )::integer AS pin_sisa
    FROM public.tr_kirim k
    LEFT JOIN public.tr_register r ON r.registerno = k.registerno
    LEFT JOIN public.master_stk ms ON ms.stkid = k.stkid
    WHERE k.registerno = $1
      ${stkid ? 'AND k.stkid = $2' : ''}
    GROUP BY k.registerno, k.tpin, k.stkid, ms.namastk, k.namakirim
    `,
    stkid ? [registerno, stkid] : [registerno]
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
