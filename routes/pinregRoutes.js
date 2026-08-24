/*
const {
  requireRole
} = require('../middleware/authMiddleware');

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pinregController');
const { isAuth } = require('../middleware/auth');

router.use(isAuth);
router.get('/', requireRole('ADMIN', 'STOKIST'), ctrl.index);
router.get('/', ctrl.page);
router.get('/form', ctrl.form);
router.get('/form/:orderno', ctrl.form);
router.get('/load', ctrl.load);
router.get('/load/:orderno', ctrl.loadByOrderNo);
router.get('/products', ctrl.products);
router.get('/products/:prdid/prices', ctrl.prices);
router.post('/create', ctrl.create);
router.post('/update/:orderno', ctrl.update);
router.post('/delete/:orderno', ctrl.remove);

module.exports = router;
*/

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/pinregController');

const { isAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/authMiddleware');

router.use(isAuth);
router.use(requireRole('admin', 'stokist'));

router.get('/', ctrl.page);

router.get('/form', ctrl.form);
router.get('/form/:orderno', ctrl.form);

router.get('/load', ctrl.load);
router.get('/load/:orderno', ctrl.loadByOrderNo);

router.get('/products', ctrl.products);
router.get('/products/:prdid/prices', ctrl.prices);

router.post('/create', ctrl.create);
router.post('/update/:orderno', ctrl.update);

router.post('/delete/:orderno', ctrl.remove);

module.exports = router;
