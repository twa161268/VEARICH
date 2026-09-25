const express=require('express');
const router=express.Router();
const c=require('../controllers/inventoryController');
const {isAuth}=require('../middleware/auth');

router.use(isAuth);

// Dashboard
router.get('/',c.home);
router.get('/api/context',c.context);
router.post('/context',c.setContext);
router.get('/dashboard',c.dashboard);
router.get('/reports',c.reports);
router.get('/api/reports',c.reportData);

// Master
router.get('/master/:type',c.master);
router.get('/api/master/:type',c.masterList);
router.post('/api/master/:type',c.masterCreate);
router.put('/api/master/:type/:id',c.masterUpdate);
router.post('/api/master/:type/:id/deactivate',c.masterDeactivate);

router.get('/api/warehouses',c.warehouses);

// Product (existing master_prd)
router.get('/products',c.products);
router.get('/api/products',c.productData);
router.get('/api/products/form-data',c.productFormData);
router.get('/api/products/:prdid',c.productGet);
router.post('/api/products',c.productCreate);
router.put('/api/products/:prdid',c.productUpdate);
router.post('/api/products/:prdid/deactivate',c.productDeactivate);

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
