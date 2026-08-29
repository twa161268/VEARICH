const db = require('../db');
const repo = require('../repositories/registerRepository');

function normalizeRow(row, index) {
  const n = index + 1;
  const username = String(row?.username || '').trim();
  const usernamesp = String(row?.usernamesp || '').trim();
  const prdid = String(row?.prdid || '').trim();
  const keterangan = String(row?.keterangan || '').trim();

  if (!username) throw validation(`Baris ${n}: username wajib diisi.`);
  if (!prdid) throw validation(`Baris ${n}: produk wajib dipilih.`);

  if (username.length > 30)
    throw validation(`Baris ${n}: username maksimal 30 karakter.`);
  if (usernamesp.length > 30)
    throw validation(`Baris ${n}: usernamesp maksimal 30 karakter.`);
  if (prdid.length > 10)
    throw validation(`Baris ${n}: prdid maksimal 10 karakter.`);
  if (keterangan.length > 80)
    throw validation(`Baris ${n}: keterangan maksimal 80 karakter.`);

  return {
    username,
    usernamesp: usernamesp || null,
    prdid,
    keterangan: keterangan || null,
  };
}

function validation(message) {
  const err = new Error(message);
  err.status = 422;
  return err;
}

function actor(req) {
  return {
    username: req.session.user,
    stkid: req.session.stkid,
    pricecode: req.session?.param?.pricecode,
  };
}

async function listRegisters(args) {
  return repo.listRegisters(args);
}

async function getDetail(registerno, stkid) {
  const header = await repo.getRegister(registerno, stkid);
  if (!header) return null;

  const registrations = await repo.listRegistrations(registerno, stkid);

  return { header, registrations };
}

async function products(pricecode, search) {
  if (!pricecode) throw validation('Pricecode pada session belum tersedia.');
  return repo.listProducts(pricecode, search);
}

async function save(registerno, body, actorData) {
  if (!actorData?.pricecode)
    throw validation('Pricecode pada session belum tersedia.');

  registerno = String(registerno || '').trim();
  if (!registerno) throw validation('Register No wajib dipilih.');

  if (!Array.isArray(body?.rows) || body.rows.length === 0)
    throw validation('Minimal satu member harus diisi.');

  const rows = body.rows.map(normalizeRow);

  const seen = new Set();
  for (const row of rows) {
    const key = row.username.toLowerCase();
    if (seen.has(key))
      throw validation(
        `Username ${row.username} dimasukkan lebih dari satu kali.`
      );
    seen.add(key);
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Lock parent register supaya dua proses tidak dapat memakai saldo PIN
    // registerno yang sama secara bersamaan.
    // const register = await repo.getRegisterForUpdate(client, registerno);

    const register = await repo.getRegisterForUpdate(
      client,
      registerno,
      actorData.stkid
    );

    if (!register)
      throw Object.assign(
        new Error(`Register No ${registerno} tidak ditemukan.`),
        { status: 404 }
      );

    const totalPinDibeli = Number(register.tpin || 0);
    const usedBefore = await repo.getUsedPin(client, registerno);

    // Validasi username existing untuk register yang sama.
    const existingUsernames = await repo.usernamesExist(
      client,
      rows.map((r) => r.username),
      registerno
    );

    if (existingUsernames.length) {
      throw validation(
        `Username sudah terdaftar pada Register No ${registerno}: ${existingUsernames.join(', ')}.`
      );
    }

    const prepared = [];
    let pinBaru = 0;

    // Semua nilai pin diambil ulang dari database berdasarkan
    // prdid + pricecode dari session.
    for (const row of rows) {
      const product = await repo.getProduct(
        client,
        row.prdid,
        actorData.pricecode
      );

      if (!product) {
        throw validation(
          `Produk ${row.prdid} tidak valid untuk pricecode ${actorData.pricecode}.`
        );
      }

      const pin = Number(product.pin || 0);

      if (!Number.isInteger(pin) || pin < 0) {
        throw validation(
          `Nilai PIN produk ${row.prdid} tidak valid pada pricetab.`
        );
      }

      pinBaru += pin;

      prepared.push({
        ...row,
        registerno,
        pricecode: actorData.pricecode,
        pin_terpakai: pin,
        actor: actorData.username,
      });
    }

    const totalAfter = usedBefore + pinBaru;

    if (totalAfter > totalPinDibeli) {
      const sisa = Math.max(totalPinDibeli - usedBefore, 0);
      throw validation(
        `Sisa PIN tidak mencukupi. Sisa PIN: ${sisa}. PIN dibutuhkan: ${pinBaru}.`
      );
    }

    const pinSisaAkhir = totalPinDibeli - totalAfter;

    for (const row of prepared) {
      await repo.insertRegister(client, {
        ...row,
        pin_sisa: pinSisaAkhir,
      });
    }

    // Pastikan seluruh record register ini menunjukkan saldo akhir yang sama.
    await repo.updatePinSisa(client, registerno, pinSisaAkhir);

    await client.query('COMMIT');

    return getDetail(registerno, actorData.stkid);
  } catch (err) {
    await client.query('ROLLBACK');

    if (err.code === '23505') {
      err.status = 409;
      err.message =
        'Data registrasi sudah ada atau melanggar unique key database.';
    }

    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  actor,
  listRegisters,
  getDetail,
  products,
  save,
};
