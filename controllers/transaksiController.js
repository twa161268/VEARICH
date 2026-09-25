const service = require('../services/transaksiService');
const db = require('../db');
const {isAdmin,sessionStkid,requireStockistScope}=require('../middleware/accessScope');

function actor(req, selectedStkid) {
  return {
    username: req.session.user,
    stkid: requireStockistScope(req, selectedStkid),
    pricecode: req.session.param?.pricecode,
  };
}
function sendError(res, e) {
  console.error('❌ TRANSAKSI PIN & KIRIM ERROR:', e);
  return res
    .status(e.status || e.statusCode || 500)
    .json({ success: false, msg: e.message || 'Internal Server Error' });
}

exports.page = async (req, res) => {
  const stockists=await db.query(`SELECT stkid,namastk FROM master_stk ORDER BY stkid`);
  res.render('transaksiPinKirim', {
    user:req.session.user||null, role:req.session.role, isAdmin:isAdmin(req),
    stockists, selectedStkid:isAdmin(req)?(req.query.stkid||''):sessionStkid(req),
    pricecode:req.session.param?.pricecode||'',
  });
};
exports.form = async (req,res) => {
  const stockists=await db.query(`SELECT stkid,namastk FROM master_stk ORDER BY stkid`);
  let selected=isAdmin(req)?(req.query.stkid||''):sessionStkid(req);
  if(req.params.registerno){
    const data=await service.getDetail(req.params.registerno,null);
    if(!data)return res.status(404).send('Register tidak ditemukan.');
    selected=data.header.stkid;
    if(!isAdmin(req)&&selected!==sessionStkid(req))return res.status(403).send('Register bukan milik stockist Anda.');
  }
  res.render('transaksiPinKirimForm',{
    user:req.session.user||null,role:req.session.role,isAdmin:isAdmin(req),
    stockists,selectedStkid:selected||'',sessionStkid:sessionStkid(req),
    pricecode:req.session.param?.pricecode||'',edit:Boolean(req.params.registerno),registerno:req.params.registerno||''
  });
};
exports.load = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    res.json({
      success: true,
      data: await service.list({
        stkid: isAdmin(req) ? (req.query.stkid || null) : sessionStkid(req),
        search: req.query.search || '',
        page,
        limit,
      }),
    });
  } catch (e) {
    sendError(res, e);
  }
};
exports.detail = async (req, res) => {
  try {
    const data = await service.getDetail(
      req.params.registerno,
      isAdmin(req) ? null : sessionStkid(req)
    );
    if (!data)
      return res
        .status(404)
        .json({ success: false, msg: 'Register tidak ditemukan.' });
    res.json({ success: true, data });
  } catch (e) {
    sendError(res, e);
  }
};
exports.products = async (req, res) => {
  try {
    res.json({
      success: true,
      data: await service.listProducts(req.query.search || ''),
    });
  } catch (e) {
    sendError(res, e);
  }
};
exports.prices = async (req, res) => {
  try {
    const pc = req.session.param?.pricecode;
    res.json({
      success: true,
      data: await service.prices(req.params.prdid, pc),
    });
  } catch (e) {
    sendError(res, e);
  }
};
exports.paymentTypes = async (req, res) => {
  try {
    res.json({ success: true, data: await service.paymentTypes() });
  } catch (e) {
    sendError(res, e);
  }
};
exports.create = async (req, res) => {
  try {
    res.json({
      success: true,
      msg: 'Transaksi berhasil disimpan!',
      data: await service.create(req.body, actor(req, isAdmin(req) ? req.body.stkid : sessionStkid(req))),
    });
  } catch (e) {
    sendError(res, e);
  }
};
exports.update = async (req, res) => {
  try {
    res.json({
      success: true,
      msg: 'Transaksi berhasil diupdate!',
      data: await service.update(req.params.registerno, req.body, actor(req, isAdmin(req) ? req.body.stkid : sessionStkid(req))),
    });
  } catch (e) {
    sendError(res, e);
  }
};
exports.remove = async (req, res) => {
  try {
    let stkid = isAdmin(req) ? (req.body?.stkid || null) : sessionStkid(req);
    if (isAdmin(req) && !stkid) {
      const existing = await service.getDetail(req.params.registerno, null);
      if (!existing) return res.status(404).json({success:false,msg:'Register tidak ditemukan.'});
      stkid = existing.header.stkid;
    }
    await service.remove(req.params.registerno, stkid);
    res.json({ success: true, msg: 'Register berhasil dihapus!' });
  } catch (e) {
    sendError(res, e);
  }
};
exports.print = async (req, res) => {
  let browser;
  try {
    const data = await service.getDetail(
      req.params.registerno,
      isAdmin(req) ? null : sessionStkid(req)
    );
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
    const html = await new Promise((resolve, reject) =>
      res.render(
        'transaksiPinKirimPrint',
        { data, company },
        (err, rendered) => (err ? reject(err) : resolve(rendered))
      )
    );
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=nota-${req.params.registerno}.pdf`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  } catch (e) {
    console.error('❌ PRINT TRANSAKSI ERROR:', e);
    res.status(500).send(e.message || 'Gagal mencetak nota.');
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};

//module.exports={page,form,load,detail,products,prices,paymentTypes,create,update,remove,print};
