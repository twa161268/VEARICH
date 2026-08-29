const service = require('../services/pembayaranService');

function actor(req) {
  return {
    username: req.session.user,
    stkid: req.session.stkid,
  };
}

function sendError(res, err) {
  console.error('❌ PEMBAYARAN ERROR:', err);
  return res.status(err.status || err.statusCode || 500).json({
    success: false,
    msg: err.message || 'Internal Server Error',
  });
}

exports.page = (req, res) => {
  res.render('pembayaran', {
    user: req.session.user || null,
  });
};

exports.newForm = async (req, res) => {
  res.render('pembayaranForm', {
    user: req.session.user || null,
  });
};

exports.detailPage = async (req, res) => {
  try {
    const data = await service.getDetail(req.params.registerno,req.session.stkid);
    if (!data) return res.status(404).send('Register tidak ditemukan.');
    res.render('pembayaranDetail', {
      user: req.session.user || null,
      data,
    });
  } catch (err) {
    res
      .status(err.status || 500)
      .send(err.message || 'Gagal mengambil detail.');
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

exports.unpaid = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const data = await service.listUnpaidTransactions({
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

exports.paymentTypes = async (req, res) => {
  try {
    res.json({ success: true, data: await service.listPayments() });
  } catch (err) {
    sendError(res, err);
  }
};

exports.detail = async (req, res) => {
  try {
    const data = await service.getDetail(req.params.registerno,req.session.stkid);
    if (!data)
      return res
        .status(404)
        .json({ success: false, msg: 'Register tidak ditemukan.' });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
};

exports.create = async (req, res) => {
  try {
    const data = await service.create(req.body, actor(req));
    res.json({
      success: true,
      msg: 'Pembayaran dan pengiriman berhasil disimpan.',
      data,
    });
  } catch (err) {
    sendError(res, err);
  }
};

exports.remove = async (req, res) => {
  try {
    await service.remove(req.params.registerno,req.session.stkid);
    res.json({ success: true, msg: 'Register berhasil dihapus.' });
  } catch (err) {
    sendError(res, err);
  }
};

exports.print = async (req, res) => {
  let browser;
  try {
    const data = await service.getDetail(req.params.registerno,req.session.stkid);
    if (!data) return res.status(404).send('Register tidak ditemukan.');

    const db = require('../db');
    const paramRows = await db.query(
      'SELECT company FROM public.param LIMIT 1'
    );
    const company = paramRows[0]?.company || '';

    if (process.env.NODE_ENV === 'production') {
      const puppeteer = require('puppeteer-core');
      const chromium = require('@sparticuz/chromium');
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await browser.newPage();
    const html = await new Promise((resolve, reject) => {
      res.render('pembayaranPrint', { data, company }, (err, rendered) =>
        err ? reject(err) : resolve(rendered)
      );
    });

    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' },
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=nota-${req.params.registerno}.pdf`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  } catch (err) {
    console.error('❌ PRINT PEMBAYARAN ERROR:', err);
    res.status(500).send(err.message || 'Gagal mencetak nota.');
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};
