const db = require('../db');

async function listRegisters({
  stkid = null,
  search = '',
  page = 1,
  limit = 20,
}) {
  const offset = (page - 1) * limit,
    q = `%${String(search || '').trim()}%`,
    p = [q],
    terms = [];
  if (stkid) {
    p.push(stkid);
    terms.push(`k.stkid=$${p.length}`);
  }
  const where = terms.length ? `AND ${terms.join(' AND ')}` : '';
  const rows = await db.query(
    `
    SELECT k.registerno,k.stkid,ms.namastk,k.kirim,k.namakirim,k.alamat,k.kota,k.ongkir,
      k.bayar,k.tamount,k.tpin,k.createdt,k.status_ambil,
      (SELECT COUNT(*)::int FROM public.tr_pinreg r WHERE r.registerno=k.registerno AND r.stkid=k.stkid) AS jumlah_transaksi,
      COALESCE((SELECT SUM(d.qty*d.dp) FROM public.tr_pinreg r JOIN public.tr_pinregdet d ON d.orderno=r.orderno WHERE r.registerno=k.registerno AND r.stkid=k.stkid),0)::numeric(18,2) AS total_dp,
      COALESCE((SELECT SUM(d.qty*d.pin) FROM public.tr_pinreg r JOIN public.tr_pinregdet d ON d.orderno=r.orderno WHERE r.registerno=k.registerno AND r.stkid=k.stkid),0)::numeric(18,2) AS total_pin,
      COALESCE((SELECT SUM(d.qty*d.bv) FROM public.tr_pinreg r JOIN public.tr_pinregdet d ON d.orderno=r.orderno WHERE r.registerno=k.registerno AND r.stkid=k.stkid),0)::numeric(18,2) AS total_bv,
      COALESCE((SELECT SUM(b.amount) FROM public.tr_bayar b WHERE b.registerno=k.registerno),0)::numeric(18,2) AS total_bayar
    FROM public.tr_kirim k LEFT JOIN master_stk ms ON ms.stkid=k.stkid
    WHERE (k.registerno ILIKE $1 OR COALESCE(k.namakirim,'') ILIKE $1 OR COALESCE(k.kota,'') ILIKE $1 OR COALESCE(k.alamat,'') ILIKE $1)
      ${where}
    ORDER BY k.createdt DESC NULLS LAST,k.registerno DESC
    LIMIT $${p.length + 1} OFFSET $${p.length + 2}
  `,
    [...p, limit, offset]
  );
  const count = await db.query(
    `
    SELECT COUNT(*)::int AS total FROM public.tr_kirim k
    WHERE (k.registerno ILIKE $1 OR COALESCE(k.namakirim,'') ILIKE $1 OR COALESCE(k.kota,'') ILIKE $1 OR COALESCE(k.alamat,'') ILIKE $1)
      ${where}`,
    p
  );
  return { rows, total: count[0]?.total || 0, page, limit };
}

async function getRegister(client, registerno, stkid = null) {
  const params = stkid ? [registerno, stkid] : [registerno];
  const scope = stkid ? 'AND k.stkid=$2' : '';
  const h = await client.query(
    `
  SELECT
    k.registerno,
    k.kirim,
    k.alamat,
    k.kelurahan,
    k.kecamatan,
    k.wilayah,
    k.kota,
    k.kodepos,
    k.bayar,
    k.ongkir,
    k.stkid,
    ms.namastk,
    k.createdt,
    k.updatedt,
    k.createnm,
    k.updatenm,
    k.namakirim,
    k.tamount,
    k.tpin,
    k.status_ambil,
    k.status_ambil_at,
    k.status_ambil_by
  FROM public.tr_kirim k
  LEFT JOIN master_stk ms ON ms.stkid=k.stkid
  WHERE k.registerno=$1 ${scope}
`,
    params
  );
  if (!h.rows[0]) return null;
  const t = await client.query(
    `
    SELECT r.transid,r.orderno,r.nama,r.nohp,r.usernamesp,r.namasp,r.createdt,r.updatedt,r.stbayar,r.validz,
           COALESCE(SUM(d.qty*d.dp),0)::numeric(18,2) total_dp,
           COALESCE(SUM(d.qty*d.pin),0)::numeric(18,2) total_pin,
           COALESCE(SUM(d.qty*d.bv),0)::numeric(18,2) total_bv
    FROM public.tr_pinreg r LEFT JOIN public.tr_pinregdet d ON d.orderno=r.orderno
    WHERE r.registerno=$1 ${stkid ? 'AND r.stkid=$2' : ''}
    GROUP BY r.transid,r.orderno,r.nama,r.nohp,r.usernamesp,r.namasp,r.createdt,r.updatedt,r.stbayar,r.validz
    ORDER BY r.createdt,r.orderno`,
    params
  );
  const details = await client.query(
    `
    SELECT d.orderno,d.prdid,d.pricecode,d.qty,d.dp,d.bv,d.pin,p.prdname
    FROM public.tr_pinregdet d LEFT JOIN public.master_prd p ON p.prdid=d.prdid
    JOIN public.tr_pinreg r ON r.orderno=d.orderno
    WHERE r.registerno=$1 ${stkid ? 'AND r.stkid=$2' : ''}
    ORDER BY d.orderno,p.prdname NULLS LAST,d.prdid`,
    params
  );
  const payments = await client.query(
    `
    SELECT b.registerno,b.paytype,p.deskripsi,b.amount,b.catatan
    FROM public.tr_bayar b LEFT JOIN public.payment p ON p.paytype=b.paytype
    WHERE b.registerno=$1 ORDER BY b.paytype`,
    [registerno]
  );
  return {
    header: h.rows[0],
    transactions: t.rows,
    details: details.rows,
    payments: payments.rows,
  };
}

async function listProducts(search = '') {
  const q = `%${String(search || '').trim()}%`;
  return db.query(
    `
    SELECT DISTINCT p.prdid,p.prdname,p.status,p.kode
    FROM public.master_prd p
    JOIN public.pricetab pt ON pt.prdid=p.prdid
    WHERE COALESCE(p.status,TRUE)=TRUE
      AND (p.prdid ILIKE $1 OR COALESCE(p.prdname,'') ILIKE $1)
    ORDER BY p.prdname NULLS LAST,p.prdid
    LIMIT 200
  `,
    [q]
  );
}

async function getPrice(client, prdid, pricecode) {
  const r = await client.query(
    `
    SELECT pt.prdid,pt.pricecode,pt.dp,pt.bv,pt.pin,p.prdname
    FROM public.pricetab pt
    LEFT JOIN public.master_prd p ON p.prdid=pt.prdid
    WHERE pt.prdid=$1 AND pt.pricecode=$2 AND COALESCE(p.status,TRUE)=TRUE
  `,
    [prdid, pricecode]
  );
  return r.rows[0] || null;
}

async function listPrices(prdid, pricecode) {
  return db.query(
    `
    SELECT pt.prdid,pt.pricecode,pt.dp,pt.bv,pt.pin,p.prdname
    FROM public.pricetab pt
    LEFT JOIN public.master_prd p ON p.prdid=pt.prdid
    WHERE pt.prdid=$1 AND pt.pricecode=$2
  `,
    [prdid, pricecode]
  );
}

async function listPaymentTypes() {
  return db.query(
    `SELECT paytype,deskripsi FROM public.payment ORDER BY paytype`
  );
}

async function generateRegisterNo(client) {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext('transaksi_kirim_registerno'))`
  );
  const yy = String(new Date().getFullYear()).slice(-2);
  const r = await client.query(
    `
    SELECT COALESCE(MAX(CAST(SUBSTRING(registerno FROM 4) AS INTEGER)),0) AS max_no
    FROM public.tr_kirim WHERE registerno ~ $1
  `,
    [`^R${yy}[0-9]+$`]
  );
  return `R${yy}${String(Number(r.rows[0]?.max_no || 0) + 1).padStart(5, '0')}`;
}

async function generateOrderNo(client) {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext('transaksi_kirim_orderno'))`
  );
  const yy = String(new Date().getFullYear()).slice(-2);
  const r = await client.query(
    `
    SELECT COALESCE(MAX(CAST(SUBSTRING(orderno FROM 3) AS INTEGER)),0) AS max_no
    FROM public.tr_pinreg WHERE orderno ~ $1
  `,
    [`^${yy}[0-9]+$`]
  );
  return `${yy}${String(Number(r.rows[0]?.max_no || 0) + 1).padStart(4, '0')}`;
}

async function generateTransId(client) {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext('transaksi_kirim_transid'))`
  );
  const r = await client.query(
    `SELECT COALESCE(MAX(transid),0) AS max_id FROM public.tr_pinreg`
  );
  return Number(r.rows[0]?.max_id || 0) + 1;
}

async function insertRegister(client, d) {
  const r = await client.query(
    `
    INSERT INTO public.tr_kirim
      (registerno,kirim,alamat,kelurahan,kecamatan,wilayah,kota,kodepos,bayar,ongkir,
       stkid,createdt,updatedt,createnm,updatenm,namakirim,tamount,tpin,status_ambil)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::numeric,$10::numeric,$11,NOW(),NOW(),$12,$12,$13,$14::numeric,$15::integer,'BELUM')
    RETURNING *
  `,
    [
      d.registerno,
      d.kirim,
      d.alamat,
      d.kelurahan,
      d.kecamatan,
      d.wilayah,
      d.kota,
      d.kodepos,
      d.bayar,
      d.ongkir,
      d.stkid,
      d.username,
      d.namakirim,
      d.tamount,
      d.tpin,
    ]
  );
  return r.rows[0];
}

async function insertPinreg(client, d) {
  await client.query(
    `
    INSERT INTO public.tr_pinreg
      (transid,nama,nohp,usernamesp,namasp,orderno,createdt,createnm,registerno,stkid,validz,stbayar)
    VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9,FALSE,TRUE)
  `,
    [
      d.transid,
      d.nama,
      d.nohp,
      d.usernamesp,
      d.namasp,
      d.orderno,
      d.username,
      d.registerno,
      d.stkid,
    ]
  );
}

async function insertDetail(client, d) {
  await client.query(
    `
    INSERT INTO public.tr_pinregdet(orderno,prdid,pricecode,qty,dp,bv,pin)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
  `,
    [d.orderno, d.prdid, d.pricecode, d.qty, d.dp, d.bv, d.pin]
  );
}

async function insertPayment(client, registerno, p) {
  await client.query(
    `
    INSERT INTO public.tr_bayar(registerno,paytype,amount,catatan)
    VALUES ($1,$2,$3::numeric,$4)
  `,
    [registerno, p.paytype, p.amount, p.catatan]
  );
}

async function paymentTotal(client, registerno) {
  const r = await client.query(
    `
    SELECT COALESCE(SUM(amount),0)::numeric(18,2) AS total
    FROM public.tr_bayar WHERE registerno=$1
  `,
    [registerno]
  );
  return r.rows[0]?.total || '0.00';
}

async function deleteRegisterData(client, registerno, stkid) {
  await client.query(`DELETE FROM public.tr_bayar WHERE registerno=$1`, [
    registerno,
  ]);
  const orders = await client.query(
    `SELECT orderno FROM public.tr_pinreg WHERE registerno=$1 AND stkid=$2`,
    [registerno, stkid]
  );
  const ordernos = orders.rows.map((x) => x.orderno);
  if (ordernos.length)
    await client.query(
      `DELETE FROM public.tr_pinregdet WHERE orderno=ANY($1::varchar[])`,
      [ordernos]
    );
  await client.query(
    `DELETE FROM public.tr_pinreg WHERE registerno=$1 AND stkid=$2`,
    [registerno, stkid]
  );
  await client.query(
    `DELETE FROM public.tr_kirim WHERE registerno=$1 AND stkid=$2`,
    [registerno, stkid]
  );
}

module.exports = {
  listRegisters,
  getRegister,
  listProducts,
  getPrice,
  listPrices,
  listPaymentTypes,
  generateRegisterNo,
  generateOrderNo,
  generateTransId,
  insertRegister,
  insertPinreg,
  insertDetail,
  insertPayment,
  paymentTotal,
  deleteRegisterData,
};
