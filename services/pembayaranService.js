const db = require('../db');
const repo = require('../repositories/pembayaranRepository');

function fail(message, status = 422) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function clean(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s || null;
}

function parseMoney(value, fieldName) {
  if (value === null || value === undefined || value === '') return '0.00';
  let raw = String(value)
    .trim()
    .replace(/[^0-9.,]/g, '');
  if (!raw) fail(`${fieldName} tidak valid.`);

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const decimals = raw.length - lastComma - 1;
    raw = decimals <= 2 ? raw.replace(',', '.') : raw.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const decimals = raw.length - lastDot - 1;
    if ((raw.match(/\./g) || []).length > 1 || decimals > 2)
      raw = raw.replace(/\./g, '');
  }

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) fail(`${fieldName} tidak valid.`);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) fail(`${fieldName} tidak valid.`);
  return n.toFixed(2);
}

function sameMoney(a, b) {
  return Number(a || 0).toFixed(2) === Number(b || 0).toFixed(2);
}

function validateCreateBody(body) {
  if (!body || !Array.isArray(body.ordernos) || body.ordernos.length === 0)
    fail('Minimal satu transaksi PIN harus dipilih.');

  const ordernos = [
    ...new Set(body.ordernos.map((x) => String(x).trim()).filter(Boolean)),
  ];
  if (!ordernos.length) fail('Minimal satu transaksi PIN harus dipilih.');

  const kirim =
    body.kirim === true ||
    body.kirim === 'true' ||
    body.kirim === 1 ||
    body.kirim === '1';
  const ongkir = parseMoney(body.ongkir, 'Ongkos kirim');

  if (kirim && !clean(body.namakirim))
    fail('Nama kirim wajib diisi jika kirim barang aktif.');
  if (kirim && !clean(body.alamat))
    fail('Alamat wajib diisi jika kirim barang aktif.');
  if (kirim && !clean(body.kelurahan))
    fail('Kelurahan wajib diisi jika kirim barang aktif.');
  if (kirim && !clean(body.kecamatan))
    fail('Kecamatan wajib diisi jika kirim barang aktif.');
  if (kirim && !clean(body.wilayah))
    fail('Wilayah wajib diisi jika kirim barang aktif.');
  if (kirim && !clean(body.kota))
    fail('Kota wajib diisi jika kirim barang aktif.');
  if (kirim && !clean(body.kodepos))
    fail('Kode pos wajib diisi jika kirim barang aktif.');

  const payments = Array.isArray(body.payments) ? body.payments : [];
  if (!payments.length) fail('Minimal satu pembayaran harus diisi.');

  const seenPaytype = new Set();
  const cleanedPayments = payments.map((p, i) => {
    const paytype = clean(p.paytype);
    if (!paytype) fail(`Baris pembayaran ${i + 1}: paytype wajib dipilih.`);
    if (seenPaytype.has(paytype))
      fail(`Paytype ${paytype} tidak boleh dimasukkan dua kali.`);
    seenPaytype.add(paytype);
    const amount = parseMoney(p.amount, `Amount pembayaran baris ${i + 1}`);
    if (Number(amount) <= 0)
      fail(`Amount pembayaran baris ${i + 1} harus lebih besar dari 0.`);
    return { paytype, amount, catatan: clean(p.catatan) };
  });

  return {
    ordernos,
    kirim,
    namakirim: clean(body.namakirim),
    alamat: clean(body.alamat),
    kelurahan: clean(body.kelurahan),
    kecamatan: clean(body.kecamatan),
    wilayah: clean(body.wilayah),
    kota: clean(body.kota),
    kodepos: clean(body.kodepos),
    ongkir: kirim ? ongkir : '0.00',
    payments: cleanedPayments,
  };
}

async function create(body, actor) {
  if (!actor?.username) fail('Session username tidak tersedia.', 401);
  if (!actor?.stkid) fail('STKID user login tidak tersedia.', 422);

  const input = validateCreateBody(body);
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const locked = await repo.lockAndGetSelectedTransactions(
      client,
      input.ordernos
    );
    if (locked.rowCount !== input.ordernos.length) {
      fail('Salah satu transaksi PIN tidak ditemukan.', 409);
    }

    const alreadyProcessed = locked.rows.find((r) => r.stbayar === true);
    if (alreadyProcessed) {
      fail(
        `Transaksi ${alreadyProcessed.orderno} sudah diproses sebelumnya.`,
        409
      );
    }

    const totalBarang = await repo.calculateGoodsTotal(client, input.ordernos);
    const totalTagihan = (Number(totalBarang) + Number(input.ongkir)).toFixed(
      2
    );

    const paytypeList = input.payments.map((p) => p.paytype);
    const paymentTypes = await repo.validatePaymentTypes(client, paytypeList);
    if (paymentTypes.rowCount !== paytypeList.length) {
      const found = new Set(paymentTypes.rows.map((p) => p.paytype));
      const missing = paytypeList.filter((p) => !found.has(p));
      fail(`Paytype tidak ditemukan: ${missing.join(', ')}`);
    }

    const registerno = await repo.generateRegisterNo(client);

    await repo.insertRegister(client, {
      registerno,
      kirim: input.kirim,
      namakirim: input.namakirim,
      alamat: input.alamat,
      kelurahan: input.kelurahan,
      kecamatan: input.kecamatan,
      wilayah: input.wilayah,
      kota: input.kota,
      kodepos: input.kodepos,
      bayar: totalTagihan,
      ongkir: input.ongkir,
      stkid: actor.stkid,
      username: actor.username,
    });

    for (const payment of input.payments) {
      await repo.insertPayment(client, registerno, payment);
    }

    const totalBayar = await repo.paymentTotal(client, registerno);
    if (!sameMoney(totalBayar, totalTagihan)) {
      if (Number(totalBayar) < Number(totalTagihan)) {
        fail('Total pembayaran masih kurang.', 422);
      }
      fail('Total pembayaran melebihi total tagihan.', 422);
    }

    const marked = await repo.markTransactionsPaid(
      client,
      input.ordernos,
      registerno,
      actor.username
    );

    if (marked.rowCount !== input.ordernos.length) {
      fail(
        'Sebagian transaksi sudah diproses user lain. Transaksi dibatalkan.',
        409
      );
    }

    await client.query('COMMIT');
    return await getDetail(registerno);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getDetail(registerno) {
  const client = await db.pool.connect();
  try {
    return await repo.getRegister(client, registerno);
  } finally {
    client.release();
  }
}

async function remove(registerno) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await repo.getRegister(client, registerno);
    if (!existing) fail('Register tidak ditemukan.', 404);
    await repo.deleteRegister(client, registerno);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listRegisters: repo.listRegisters,
  listUnpaidTransactions: repo.listUnpaidTransactions,
  listPayments: repo.listPayments,
  getDetail,
  create,
  remove,
};
