const db = require('../db');
const repo = require('../repositories/inventoryRepository');

function fail(message, status = 422) {
  const e = new Error(message);
  e.status = status;
  throw e;
}

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function positiveInt(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) fail(`${field} harus berupa bilangan bulat lebih besar dari 0.`);
  return n;
}

function actor(req) {
  return String(req.session?.user || 'SYSTEM').trim() || 'SYSTEM';
}

function normalizeComponents(raw, packageId, pricecode) {
  if (!Array.isArray(raw) || !raw.length) fail('Minimal satu komponen paket harus diisi.');
  const seen = new Set();
  return raw.map((row, index) => {
    const prdid = clean(row?.prdid);
    const rowPricecode = clean(row?.pricecode || pricecode);
    const qty = positiveInt(row?.qty, `Qty komponen #${index + 1}`);

    if (!prdid) fail(`Komponen #${index + 1}: produk wajib dipilih.`);
    if (!rowPricecode) fail(`Komponen #${index + 1}: pricecode wajib diisi.`);
    if (rowPricecode !== pricecode) fail(`Komponen #${index + 1}: pricecode harus ${pricecode}.`);
    if (prdid === packageId) fail(`Produk paket ${packageId} tidak boleh menjadi komponennya sendiri.`);

    const key = `${prdid}|${rowPricecode}`;
    if (seen.has(key)) fail(`Komponen ${prdid} dengan pricecode ${rowPricecode} tidak boleh dimasukkan dua kali.`);
    seen.add(key);

    return { prdid, pricecode: rowPricecode, qty };
  });
}

async function validatePackage(client, prdidcat, pricecode) {
  const pkg = (await client.query(`
    SELECT p.prdid, p.prdname, p.status
    FROM public.master_prd p
    WHERE p.prdid=$1
  `, [prdidcat])).rows[0];
  if (!pkg) fail(`Produk paket ${prdidcat} tidak ditemukan.`);
  if (pkg.status === false) fail(`Produk paket ${pkg.prdname || prdidcat} tidak aktif.`);

  const packagePrice = (await client.query(`
    SELECT 1
    FROM public.pricetab
    WHERE prdid=$1 AND pricecode=$2
    LIMIT 1
  `, [prdidcat, pricecode])).rows[0];
  if (!packagePrice) fail(`Produk paket ${pkg.prdname || prdidcat} tidak memiliki pricecode ${pricecode}.`);

  return pkg;
}

async function validateComponents(client, components) {
  const checked = [];
  for (const item of components) {
    const row = (await client.query(`
      SELECT pt.prdid, pt.pricecode, p.prdname, p.status, p.stock_managed
      FROM public.pricetab pt
      JOIN public.master_prd p ON p.prdid=pt.prdid
      WHERE pt.prdid=$1 AND pt.pricecode=$2
      LIMIT 1
    `, [item.prdid, item.pricecode])).rows[0];
    if (!row) fail(`Produk komponen ${item.prdid} dengan pricecode ${item.pricecode} tidak ditemukan di pricetab.`);
    if (row.status === false) fail(`Produk komponen ${row.prdname || item.prdid} tidak aktif.`);
    checked.push({ ...item, prdname: row.prdname });
  }
  return checked;
}

async function assertNoPendingPickup(client, prdidcat, pricecode) {
  const pending = (await client.query(`
    SELECT 1
    FROM public.tr_pinregdet d
    JOIN public.tr_pinreg r ON r.orderno=d.orderno
    JOIN public.tr_kirim k ON k.registerno=r.registerno
    WHERE d.prdid=$1
      AND d.pricecode=$2
      AND COALESCE(k.status_ambil,'BELUM')='BELUM'
    LIMIT 1
  `, [prdidcat, pricecode])).rows.length;
  if (pending) {
    fail(`Paket ${prdidcat} pricecode ${pricecode} sedang memiliki transaksi yang belum diambil. Komposisi tidak boleh diubah/dihapus sampai pickup selesai.`, 409);
  }
}

async function list() {
  return repo.listMasterPacks();
}

async function options() {
  return repo.masterPakOptions();
}

async function detail(prdidcat, pricecode) {
  const row = await repo.getMasterPack(prdidcat, pricecode);
  if (!row) fail('Master Paket tidak ditemukan.', 404);
  return row;
}

async function create(req) {
  const body = req.body || {};
  const prdidcat = clean(body.prdidcat);
  const pricecode = clean(body.pricecode);
  if (!prdidcat) fail('Produk Paket wajib dipilih.');
  if (!pricecode) fail('Pricecode wajib dipilih.');
  if (pricecode.length > 4) fail('Pricecode maksimal 4 karakter.');

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await validatePackage(client, prdidcat, pricecode);
    const components = normalizeComponents(body.components, prdidcat, pricecode);
    const checked = await validateComponents(client, components);

    const existing = await client.query(`
      SELECT 1 FROM public.master_pak
      WHERE prdidcat=$1 AND pricecode=$2
      LIMIT 1
    `, [prdidcat, pricecode]);
    if (existing.rows.length) fail(`Komposisi ${prdidcat} dengan pricecode ${pricecode} sudah ada. Gunakan Edit.`);

    await repo.insertMasterPack(client, {
      prdidcat,
      prdidcatnm: (await validatePackage(client, prdidcat, pricecode)).prdname,
      pricecode,
      components: checked,
      actor: actor(req)
    });
    await client.query('COMMIT');
    return repo.getMasterPack(prdidcat, pricecode);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function update(req) {
  const prdidcat = clean(req.params.prdidcat);
  const pricecode = clean(req.params.pricecode);
  if (!prdidcat || !pricecode) fail('Identitas Master Paket tidak lengkap.');

  const body = req.body || {};
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const current = await repo.getMasterPackForUpdate(client, prdidcat, pricecode);
    if (!current) fail('Master Paket tidak ditemukan.', 404);
    await assertNoPendingPickup(client, prdidcat, pricecode);
    const pkg = await validatePackage(client, prdidcat, pricecode);
    const components = normalizeComponents(body.components, prdidcat, pricecode);
    const checked = await validateComponents(client, components);

    await repo.replaceMasterPack(client, {
      prdidcat,
      prdidcatnm: pkg.prdname,
      pricecode,
      components: checked,
      actor: actor(req)
    });
    await client.query('COMMIT');
    return repo.getMasterPack(prdidcat, pricecode);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function remove(req) {
  const prdidcat = clean(req.params.prdidcat);
  const pricecode = clean(req.params.pricecode);
  if (!prdidcat || !pricecode) fail('Identitas Master Paket tidak lengkap.');

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const current = await repo.getMasterPackForUpdate(client, prdidcat, pricecode);
    if (!current) fail('Master Paket tidak ditemukan.', 404);
    await assertNoPendingPickup(client, prdidcat, pricecode);
    await repo.deleteMasterPack(client, prdidcat, pricecode);
    await client.query('COMMIT');
    return { deleted: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { list, options, detail, create, update, remove };
