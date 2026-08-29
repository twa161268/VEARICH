const service = require('../services/registerService');

function sendError(res, err) {
  console.error('❌ REGISTRASI MEMBER ERROR:', err);

  return res.status(err.status || err.statusCode || 500).json({
    success: false,
    msg: err.message || 'Internal Server Error',
  });
}

function actor(req) {
  return service.actor(req);
}

exports.page = (req, res) => {
  res.render('register', {
    user: req.session.user || null,
    pricecode: req.session?.param?.pricecode || '',
  });
};

exports.form = async (req, res) => {
  try {
    const registerno = String(req.params.registerno || '').trim();

    if (!registerno) {
      return res.redirect('/register');
    }

    // const data = await service.getDetail(registerno);

    const data = await service.getDetail(registerno, req.session.stkid);

    if (!data) return res.status(404).send('Register No tidak ditemukan.');

    res.render('registerForm', {
      user: req.session.user || null,
      pricecode: req.session?.param?.pricecode || '',
      data,
    });
  } catch (err) {
    sendError(res, err);
  }
};

exports.load = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);

    const data = await service.listRegisters({
      stkid: req.session.stkid,
      search: req.query.search || '',
      page,
      limit,
    });

    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
};

exports.detail = async (req, res) => {
  try {
    const data = await service.getDetail(
      req.params.registerno,
      req.session.stkid
    );

    if (!data)
      return res
        .status(404)
        .json({ success: false, msg: 'Register No tidak ditemukan.' });

    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
};

exports.products = async (req, res) => {
  try {
    const pricecode = req.session?.param?.pricecode;
    const data = await service.products(pricecode, req.query.search || '');

    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
};

exports.save = async (req, res) => {
  try {
    const data = await service.save(
      req.params.registerno,
      req.body,
      actor(req)
    );

    res.json({
      success: true,
      msg: 'Registrasi member berhasil disimpan.',
      data,
    });
  } catch (err) {
    sendError(res, err);
  }
};
