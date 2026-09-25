const service = require('../services/pinregService');
const db = require('../db');
const { isAdmin, sessionStkid, requireStockistScope } = require('../middleware/accessScope');

function actor(req, selectedStkid) {
  return {
    username: req.session.user,
    stkid: requireStockistScope(req, selectedStkid),
    pricecode: req.session.param.pricecode,
  };
}

exports.page = async (req, res, next) => {
  try {
    const stockists = await db.query(`
      SELECT stkid, namastk
      FROM master_stk
      ORDER BY stkid
    `);
    res.render('pinreg', {
      user: req.session.user || null,
      role: req.session.role,
      pricecode: req.session.param.pricecode,
      isAdmin: isAdmin(req),
      sessionStkid: sessionStkid(req),
      stockists,
      selectedStkid: isAdmin(req) ? (req.query.stkid || '') : sessionStkid(req),
    });
  } catch (err) { next(err); }
};

exports.form = async (req, res, next) => {
  try {
    const stockists = await db.query(`SELECT stkid,namastk FROM master_stk ORDER BY stkid`);
    const selectedStkid = isAdmin(req)
      ? (req.query.stkid || '')
      : sessionStkid(req);

    // Untuk transaksi baru ADMIN harus memilih stockist. Saat edit, ambil dari transaksi.
    let editStkid = selectedStkid;
    if (req.params.orderno) {
      const found = await service.getByOrderNo(req.params.orderno, null);
      if (!found) return res.status(404).send('Transaksi tidak ditemukan.');
      editStkid = found.header.stkid;
      if (!isAdmin(req) && editStkid !== sessionStkid(req))
        return res.status(403).send('Transaksi bukan milik stockist Anda.');
    }

    res.render('pinregForm', {
      user: req.session.user || null,
      role: req.session.role,
      pricecode: req.session.param.pricecode,
      isAdmin: isAdmin(req),
      sessionStkid: sessionStkid(req),
      stockists,
      selectedStkid: editStkid || '',
      edit: Boolean(req.params.orderno),
      orderno: req.params.orderno || '',
    });
  } catch (err) { next(err); }
};

exports.load = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const stkid = isAdmin(req) ? (req.query.stkid || null) : sessionStkid(req);
    const data = await service.list({
      stkid,
      search: req.query.search || '',
      page,
      limit,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.loadByOrderNo = async (req, res, next) => {
  try {
    const stkid = isAdmin(req) ? null : sessionStkid(req);
    const data = await service.getByOrderNo(req.params.orderno, stkid);
    if (!data) return res.status(404).json({ success: false, msg: 'Transaksi tidak ditemukan!' });

    if (isAdmin(req)) {
      // ADMIN global boleh membuka transaksi apa pun.
    }
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.stockists = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await db.query(`SELECT stkid,namastk FROM master_stk ORDER BY stkid`),
    });
  } catch (err) { next(err); }
};

exports.products = async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.listProducts(req.query.search || '') });
  } catch (err) { next(err); }
};

exports.prices = async (req, res, next) => {
  try {
    const pricecode = req.session.param.pricecode;
    res.json({ success: true, data: await service.listPrices(req.params.prdid, pricecode) });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const selected = isAdmin(req) ? req.body.stkid : sessionStkid(req);
    const data = await service.create(req.body, actor(req, selected));
    res.json({ success: true, msg: 'Transaksi berhasil disimpan!', data });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const selected = isAdmin(req) ? req.body.stkid : sessionStkid(req);
    const data = await service.update(req.params.orderno, req.body, actor(req, selected));
    res.json({ success: true, msg: 'Transaksi berhasil diupdate!', data });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    let stkid = isAdmin(req) ? (req.body.stkid || null) : sessionStkid(req);
    if (isAdmin(req) && !stkid) {
      const existing = await service.getByOrderNo(req.params.orderno, null);
      if (!existing) return res.status(404).json({success:false,msg:'Transaksi tidak ditemukan.'});
      stkid = existing.header.stkid;
    }
    await service.remove(req.params.orderno, stkid);
    res.json({ success: true, msg: 'Transaksi berhasil dihapus!' });
  } catch (err) { next(err); }
};
