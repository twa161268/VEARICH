const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pembayaranController');
const { isAuth } = require('../middleware/auth');

router.use(isAuth);

router.get('/', ctrl.page);
router.get('/baru', ctrl.newForm);
router.get('/detail/:registerno', ctrl.detailPage);
router.get('/load', ctrl.load);
router.get('/transaksi', ctrl.unpaid);
router.get('/payment', ctrl.paymentTypes);
router.get('/api/detail/:registerno', ctrl.detail);
router.get('/print/:registerno', ctrl.print);
router.post('/create', ctrl.create);
router.delete('/:registerno', ctrl.remove);

module.exports = router;
