const express=require('express');
const router=express.Router();
const ctrl=require('../controllers/transaksiController');
const {isAuth}=require('../middleware/auth');
const {requireRole}=require('../middleware/authMiddleware');

router.use(isAuth);
router.use(requireRole('admin','stokist'));

router.get('/',ctrl.page);
router.get('/form',ctrl.form);
router.get('/form/:registerno',ctrl.form);
router.get('/load',ctrl.load);
router.get('/detail/:registerno',ctrl.detail);
router.get('/print/:registerno',ctrl.print);
router.get('/products',ctrl.products);
router.get('/products/:prdid/prices',ctrl.prices);
router.get('/payment',ctrl.paymentTypes);
router.post('/create',ctrl.create);
router.post('/update/:registerno',ctrl.update);
router.delete('/:registerno',ctrl.remove);

module.exports=router;
