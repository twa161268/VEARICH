const service = require('../services/pinregService');

//function actor(req) {
// return {
//    username: req.session.user || 'SYSTEM',
//    stkid: req.session.stkid || null,
//  };
//}

function actor(req) {
  return {
    username: req.session.user,
    stkid: req.session.stkid,
    pricecode: req.session.param.pricecode,
  };
}

exports.page = (req, res) => {
  const pricecode = req.session.param.pricecode;
  res.render('pinreg', {
    user: req.session.user || null,
    pricecode: pricecode,
  });
};

exports.form = (req, res) => {
  const pricecode = req.session.param.pricecode;
  const stkid = req.session.stkid;

  res.render('pinregForm', {
    user: req.session.user || null,
    pricecode,
    stkid,
    edit: Boolean(req.params.orderno),
    orderno: req.params.orderno || '',
  });
};

exports.load = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);

    const stkid = req.session.stkid;

    const data = await service.list({
      stkid,
      search: req.query.search || '',
      page,
      limit,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

//exports.loadByOrderNo = async (req, res, next) => {
//  try {
//    const data = await service.getByOrderNo(req.params.orderno);
//   if (!data)
//      return res
//        .status(404)
//        .json({ success: false, msg: 'Transaksi tidak ditemukan!' });
//    res.json({ success: true, data });
//  } catch (err) {
//    next(err);
//  }
//};

exports.loadByOrderNo = async (req, res, next) => {
  try {
    const data = await service.getByOrderNo(
      req.params.orderno,
      req.session.stkid
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        msg: 'Transaksi tidak ditemukan!',
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.products = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await service.listProducts(req.query.search || ''),
    });
  } catch (err) {
    next(err);
  }
};

//exports.prices = async (req, res, next) => {
//  try {
//    res.json({
//      success: true,
//      data: await service.listPrices(req.params.prdid, service.PRICE_CODE),
//    });
//  } catch (err) {
//    next(err);
//  }
//};

exports.prices = async (req, res, next) => {
  try {
    const pricecode = req.session.param.pricecode;
    res.json({
      success: true,
      data: await service.listPrices(req.params.prdid, pricecode),
    });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = await service.create(req.body, actor(req));
    res.json({ success: true, msg: 'Transaksi berhasil disimpan!', data });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const data = await service.update(req.params.orderno, req.body, actor(req));
    res.json({ success: true, msg: 'Transaksi berhasil diupdate!', data });
  } catch (err) {
    next(err);
  }
};

//exports.remove = async (req, res, next) => {
//  try {
//    await service.remove(req.params.orderno);
//    res.json({ success: true, msg: 'Transaksi berhasil dihapus!' });
//  } catch (err) {
//    next(err);
//  }
//};

exports.remove = async (req, res, next) => {
  try {
    await service.remove(req.params.orderno, req.session.stkid);

    res.json({
      success: true,
      msg: 'Transaksi berhasil dihapus!',
    });
  } catch (err) {
    next(err);
  }
};
