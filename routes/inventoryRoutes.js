const express=require('express');
const router=express.Router();
const c=require('../controllers/inventoryController');
const {isAuth}=require('../middleware/auth');
const {requireRole}=require('../middleware/authMiddleware');

router.use(isAuth);

// Dashboard
router.get('/',c.home);
router.get('/api/context',c.context);
router.post('/context',c.setContext);
router.get('/dashboard',c.dashboard);
router.get('/reports',c.reports);
router.get('/api/reports',c.reportData);

// Master Paket: ADMIN ONLY
router.get('/master/paket',requireRole('admin'),c.masterPak);
router.get('/api/master-paket',requireRole('admin'),c.masterPakList);
router.get('/api/master-paket/options',requireRole('admin'),c.masterPakOptions);
router.get('/api/master-paket/:prdidcat/:pricecode',requireRole('admin'),c.masterPakGet);
router.post('/api/master-paket',requireRole('admin'),c.masterPakCreate);
router.put('/api/master-paket/:prdidcat/:pricecode',requireRole('admin'),c.masterPakUpdate);
router.delete('/api/master-paket/:prdidcat/:pricecode',requireRole('admin'),c.masterPakDelete);

// Master: ADMIN ONLY (server-side authorization)
router.get('/master/:type',requireRole('admin'),c.master);
router.get('/api/master/:type',requireRole('admin'),c.masterList);
router.post('/api/master/:type',requireRole('admin'),c.masterCreate);
router.put('/api/master/:type/:id',requireRole('admin'),c.masterUpdate);
router.post('/api/master/:type/:id/deactivate',requireRole('admin'),c.masterDeactivate);

router.get('/api/warehouses',c.warehouses);

// Product (existing master_prd): ADMIN ONLY
router.get('/products',requireRole('admin'),c.products);
router.get('/api/products',requireRole('admin'),c.productData);
router.get('/api/products/form-data',requireRole('admin'),c.productFormData);
router.get('/api/products/:prdid',requireRole('admin'),c.productGet);
router.post('/api/products',requireRole('admin'),c.productCreate);
router.put('/api/products/:prdid',requireRole('admin'),c.productUpdate);
router.post('/api/products/:prdid/deactivate',requireRole('admin'),c.productDeactivate);

// Transactions
router.get('/transaksi/:type',c.transactions);
router.get('/api/transaksi/:type',c.transactionData);
router.get('/api/transaksi/:type/:id',c.transactionGet);
router.post('/api/transaksi/:type',c.transactionCreate);
router.put('/api/transaksi/:type/:id',c.transactionUpdate);
router.delete('/api/transaksi/:type/:id',c.transactionDelete);
router.post('/api/transaksi/:type/:id/cancel',c.transactionCancel);
router.post('/api/transaksi/:type/:id/final',c.transactionFinal);

// Stock
router.get('/stock',c.stock);
router.get('/api/stock',c.stockData);
router.get('/movement',c.movement);
router.get('/api/movement',c.movementData);

// Pickup
router.get('/pickup',c.pickup);
router.get('/api/pickup',c.pickupData);
router.post('/api/pickup/:registerno/process',c.pickupProcess);
router.post('/api/pickup/:registerno/cancel',c.pickupCancel);

module.exports=router;
