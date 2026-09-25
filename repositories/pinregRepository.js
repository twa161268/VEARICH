const db = require('../db');

async function list({ stkid = null, search = '', page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const q = `%${String(search || '').trim()}%`;
  const params = [q];
  const scope = stkid ? `AND r.stkid = $${params.length + 1}` : '';
  if (stkid) params.push(stkid);

  const data = await db.query(`
    SELECT r.orderno, r.registerno, r.nama, r.usernamesp, r.createdt,
           r.stkid, ms.namastk,
           COALESCE(SUM(d.qty * d.dp), 0)::numeric(18,2) AS total_harga,
           COALESCE(SUM(d.qty * d.pin), 0)::numeric(18,2) AS total_pin,
           COALESCE(SUM(d.qty * d.bv), 0)::numeric(18,2) AS total_bv,
           r.validz, r.stbayar
    FROM tr_pinreg r
    LEFT JOIN tr_pinregdet d ON d.orderno = r.orderno
    LEFT JOIN master_stk ms ON ms.stkid = r.stkid
    WHERE (r.orderno ILIKE $1
       OR COALESCE(r.nama, '') ILIKE $1
       OR COALESCE(r.usernamesp, '') ILIKE $1)
      ${scope}
    GROUP BY r.orderno,r.registerno,r.nama,r.usernamesp,r.createdt,
             r.stkid,ms.namastk,r.validz,r.stbayar
    ORDER BY r.createdt DESC NULLS LAST, r.orderno DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  const count = await db.query(`
    SELECT COUNT(*)::int AS total
    FROM tr_pinreg r
    WHERE (r.orderno ILIKE $1
       OR COALESCE(r.nama, '') ILIKE $1
       OR COALESCE(r.usernamesp, '') ILIKE $1)
      ${scope}
  `, params);

  return { rows: data, total: count[0].total, page, limit };
}

async function findByOrderNo(client, orderno, stkid = null) {
  const scope = stkid ? 'AND r.stkid=$2' : '';
  const params = stkid ? [orderno, stkid] : [orderno];

  const header = await client.query(`
    SELECT r.transid,r.nama,r.nohp,r.usernamesp,r.namasp,r.orderno,
           r.createdt,r.createnm,r.updatedt,r.updatenm,r.registerno,
           r.stkid,ms.namastk,r.validz,r.stbayar
    FROM tr_pinreg r
    LEFT JOIN master_stk ms ON ms.stkid=r.stkid
    WHERE r.orderno=$1 ${scope}
  `, params);

  if (!header.rows[0]) return null;

  const details = await client.query(`
    SELECT d.orderno,d.prdid,d.pricecode,d.qty,d.dp,d.bv,d.pin,
           p.prdname,pt.dp AS master_dp,pt.bv AS master_bv,pt.pin AS master_pin
    FROM tr_pinregdet d
    JOIN pricetab pt ON pt.prdid=d.prdid AND pt.pricecode=d.pricecode
    LEFT JOIN master_prd p ON p.prdid=d.prdid
    WHERE d.orderno=$1
    ORDER BY p.prdname NULLS LAST,d.prdid
  `, [orderno]);

  return { header: header.rows[0], details: details.rows };
}

async function getPrice(client, prdid, pricecode) {
  const result = await client.query(`
    SELECT pt.prdid,pt.pricecode,pt.dp,pt.bv,pt.pin,p.prdname
    FROM pricetab pt
    LEFT JOIN master_prd p ON p.prdid=pt.prdid
    WHERE pt.prdid=$1 AND pt.pricecode=$2
      AND COALESCE(p.status,TRUE)=TRUE
  `, [prdid, pricecode]);
  return result.rows[0] || null;
}

async function listProducts(search = '') {
  const q = `%${String(search || '').trim()}%`;
  return db.query(`
    SELECT DISTINCT p.prdid,p.prdname,p.status,p.kode,p.prdgroup
    FROM master_prd p JOIN pricetab pt ON pt.prdid=p.prdid
    WHERE COALESCE(p.status,TRUE)=TRUE
      AND (p.prdid ILIKE $1 OR COALESCE(p.prdname,'') ILIKE $1)
    ORDER BY p.prdname NULLS LAST,p.prdid LIMIT 100
  `, [q]);
}

async function listPrices(prdid, pricecode = '2601') {
  return db.query(`
    SELECT pt.prdid,pt.pricecode,pt.dp,pt.bv,pt.pin,p.prdname
    FROM pricetab pt LEFT JOIN master_prd p ON p.prdid=pt.prdid
    WHERE pt.prdid=$1 AND pt.pricecode=$2
  `, [prdid, pricecode]);
}

module.exports = { list, findByOrderNo, getPrice, listProducts, listPrices };
