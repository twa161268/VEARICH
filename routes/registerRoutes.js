const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/registerController');
const { isAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/authMiddleware');

router.use(isAuth);
router.use(requireRole('admin', 'stokist'));

router.get('/', ctrl.page);
router.get('/form/:registerno', ctrl.form);

router.get('/load', ctrl.load);
router.get('/load/:registerno', ctrl.detail);
router.get('/products', ctrl.products);

router.post('/save/:registerno', ctrl.save);

module.exports = router;
