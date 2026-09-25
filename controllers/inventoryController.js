const svc=require('../services/inventoryService');
const repo=require('../repositories/inventoryRepository');
const db=require('../db');
const {isAdmin,sessionStkid,scopedStkid,requireStockistScope}=require('../middleware/accessScope');

const TYPES=['masuk','keluar','retur_beli','retur_jual','transfer','adjustment','opname'];
const names={masuk:'Barang Masuk',keluar:'Barang Keluar',retur_beli:'Retur Pembelian',retur_jual:'Retur Penjualan',transfer:'Transfer Gudang',adjustment:'Adjustment Stock',opname:'Stock Opname'};

async function stockists(){
  return db.query(`SELECT stkid,namastk FROM master_stk ORDER BY stkid`);
}
function selectedContext(req){
  return isAdmin(req) ? (req.session.inventoryStkid || null) : sessionStkid(req);
}
async function requireAdmin(req,res){
  if(!isAdmin(req)){res.status(403).json({success:false,msg:'Menu ini hanya dapat dikelola ADMIN.'});return false;}
  return true;
}

exports.context=async(req,res)=>{
  try{
    const rows=await stockists();
    res.json({success:true,isAdmin:isAdmin(req),sessionStkid:sessionStkid(req),selectedStkid:selectedContext(req),stockists:rows});
  }catch(e){res.status(400).json({success:false,msg:e.message});}
};
exports.setContext=async(req,res)=>{
  try{
    const requested=req.body?.stkid || null;
    if(isAdmin(req)){
      if(requested){
        const ok=(await db.query(`SELECT 1 FROM master_stk WHERE stkid=$1`,[requested])).length;
        if(!ok) return res.status(422).json({success:false,msg:'Stockist tidak ditemukan.'});
      }
      req.session.inventoryStkid=requested;
    }else{
      req.session.inventoryStkid=sessionStkid(req);
    }
    req.session.save(err=>{
      if(err) return res.status(500).json({success:false,msg:'Gagal menyimpan konteks inventory.'});
      res.json({success:true,selectedStkid:selectedContext(req)});
    });
  }catch(e){res.status(400).json({success:false,msg:e.message});}
};

exports.home=async(req,res)=>res.render('inventory/index',{user:req.session.user,role:req.session.role,isAdmin:isAdmin(req),selectedStkid:selectedContext(req),sessionStkid:sessionStkid(req),stockists:await stockists()});
exports.dashboard=async(req,res)=>{try{res.render('inventory/dashboard',{user:req.session.user,role:req.session.role,isAdmin:isAdmin(req),selectedStkid:selectedContext(req),stockists:await stockists(),stats:await svc.getDashboard(req,selectedContext(req))})}catch(e){console.error(e);res.status(500).send('Gagal memuat dashboard inventory.')}};
exports.reports=async(req,res)=>res.render('inventory/reports',{user:req.session.user,isAdmin:isAdmin(req),selectedStkid:selectedContext(req),stockists:await stockists()});
exports.reportData=async(req,res)=>{try{res.json({success:true,data:await svc.getMovements(req,{...req.query,stkid:selectedContext(req)})})}catch(e){res.status(400).json({success:false,msg:e.message});}};

exports.master=async(req,res)=>res.render('inventory/master',{type:req.params.type,user:req.session.user,isAdmin:isAdmin(req),selectedStkid:selectedContext(req),sessionStkid:sessionStkid(req),stockists:await stockists()});
exports.masterList=async(req,res)=>{try{res.json({success:true,data:await repo.getMaster(req.params.type,selectedContext(req))})}catch(e){console.error(e);res.status(400).json({success:false,msg:e.message});}};
exports.masterCreate=async(req,res)=>{
 try{
  const type=req.params.type,d={...req.body};
  if(type==='gudang'){
    const stkid=isAdmin(req)?(d.stkid||selectedContext(req)):sessionStkid(req);
    d.stkid=requireStockistScope(req,stkid);
  }else if(!isAdmin(req)){
    return res.status(403).json({success:false,msg:'Master global hanya dapat dikelola ADMIN.'});
  }
  const r=await repo.createMaster(type,d,req.session.user);
  res.json({success:true,data:r[0]});
 }catch(e){console.error(e);res.status(e.status||400).json({success:false,msg:e.message});}
};
exports.masterUpdate=async(req,res)=>{
 try{
  const type=req.params.type,d={...req.body};
  if(type==='gudang'){
    const current=(await db.query(`SELECT * FROM sb_gudang WHERE gudang_id=$1`,[req.params.id]))[0];
    if(!current)return res.status(404).json({success:false,msg:'Gudang tidak ditemukan.'});
    if(!isAdmin(req)&&current.stkid!==sessionStkid(req))return res.status(403).json({success:false,msg:'Gudang bukan milik stockist Anda.'});
    d.stkid=current.stkid;
  }else if(!isAdmin(req)){
    return res.status(403).json({success:false,msg:'Master global hanya dapat dikelola ADMIN.'});
  }
  const r=await repo.updateMaster(type,req.params.id,d,req.session.user);
  res.json({success:true,data:r[0]});
 }catch(e){console.error(e);res.status(e.status||400).json({success:false,msg:e.message});}
};
exports.masterDeactivate=async(req,res)=>{
 try{
  const type=req.params.type;
  if(type==='gudang'){
    const current=(await db.query(`SELECT stkid FROM sb_gudang WHERE gudang_id=$1`,[req.params.id]))[0];
    if(!current)return res.status(404).json({success:false,msg:'Gudang tidak ditemukan.'});
    if(!isAdmin(req)&&current.stkid!==sessionStkid(req))return res.status(403).json({success:false,msg:'Gudang bukan milik stockist Anda.'});
  }else if(!isAdmin(req)) return res.status(403).json({success:false,msg:'Master global hanya dapat dikelola ADMIN.'});
  const r=await repo.deactivateMaster(type,req.params.id);if(r.blocked)return res.status(400).json({success:false,msg:'Data sudah digunakan dan tidak dapat dinonaktifkan.'});res.json({success:true});
 }catch(e){console.error(e);res.status(400).json({success:false,msg:e.message});}
};

exports.warehouses=async(req,res)=>{
 try{
  const stkid=isAdmin(req)?(req.query.stkid||selectedContext(req)):sessionStkid(req);
  const rows=stkid
    ? await db.query(`SELECT gudang_id,kode,nama,stkid FROM sb_gudang WHERE aktif=true AND stkid=$1 ORDER BY is_default DESC,nama`,[stkid])
    : await db.query(`SELECT gudang_id,kode,nama,stkid FROM sb_gudang WHERE aktif=true ORDER BY stkid,is_default DESC,nama`);
  res.json({success:true,data:rows});
 }catch(e){res.status(400).json({success:false,msg:e.message});}
};

exports.products=async(req,res)=>res.render('inventory/products',{user:req.session.user,isAdmin:isAdmin(req),selectedStkid:selectedContext(req),stockists:await stockists()});
exports.productData=async(req,res)=>{try{const page=Number(req.query.page||1),limit=Math.min(100,Math.max(1,Number(req.query.limit||20))),search=(req.query.search||'').trim();res.json({success:true,...await repo.getProducts(null,page,limit,search)})}catch(e){res.status(400).json({success:false,msg:e.message});}};
exports.productFormData=async(req,res)=>{try{res.json({success:true,...await repo.getProductFormData()})}catch(e){res.status(400).json({success:false,msg:e.message});}};
exports.productGet=async(req,res)=>{try{const data=await repo.getProduct(req.params.prdid);if(!data)return res.status(404).json({success:false,msg:'Produk tidak ditemukan.'});res.json({success:true,...data})}catch(e){res.status(400).json({success:false,msg:e.message});}};
exports.productCreate=async(req,res)=>{if(!await requireAdmin(req,res))return;try{res.json({success:true,data:await svc.createProduct(req)})}catch(e){console.error(e);res.status(400).json({success:false,msg:e.message})}};
exports.productUpdate=async(req,res)=>{if(!await requireAdmin(req,res))return;try{res.json({success:true,data:await svc.updateProduct(req)})}catch(e){console.error(e);res.status(400).json({success:false,msg:e.message})}};
exports.productDeactivate=async(req,res)=>{if(!await requireAdmin(req,res))return;try{res.json({success:true,data:await svc.deactivateProduct(req)})}catch(e){console.error(e);res.status(400).json({success:false,msg:e.message})}};

exports.transactions=async(req,res)=>{
 const type=req.params.type;if(!TYPES.includes(type))return res.status(404).send('Jenis transaksi tidak ditemukan.');
 res.render('inventory/transactions',{type,title:names[type],user:req.session.user,role:req.session.role,isAdmin:isAdmin(req),selectedStkid:selectedContext(req),sessionStkid:sessionStkid(req),stockists:await stockists()});
};
exports.transactionData=async(req,res)=>{try{res.json({success:true,...await repo.listTransactions(req.params.type,selectedContext(req),Number(req.query.page||1),Math.min(100,Math.max(1,Number(req.query.limit||20))),(req.query.search||'').trim())})}catch(e){res.status(400).json({success:false,msg:e.message})}};
exports.transactionGet=async(req,res)=>{try{const d=await repo.getTransaction(req.params.type,req.params.id,isAdmin(req)?null:sessionStkid(req));if(!d)return res.status(404).json({success:false,msg:'Transaksi tidak ditemukan.'});res.json({success:true,...d})}catch(e){res.status(400).json({success:false,msg:e.message})}};
exports.transactionCreate=async(req,res)=>{try{if(isAdmin(req)&&!req.body.stkid)req.body.stkid=selectedContext(req);const d=await svc.createTransaction(req.params.type,req);res.json({success:true,data:d})}catch(e){console.error(e);res.status(e.status||400).json({success:false,msg:e.message})}};
exports.transactionUpdate=async(req,res)=>{try{const d=await svc.updateTransaction(req.params.type,req.params.id,req);res.json({success:true,data:d})}catch(e){console.error(e);res.status(e.status||400).json({success:false,msg:e.message})}};
exports.transactionDelete=async(req,res)=>{try{await svc.deleteTransaction(req.params.type,req.params.id,req);res.json({success:true})}catch(e){console.error(e);res.status(e.status||400).json({success:false,msg:e.message})}};
exports.transactionCancel=async(req,res)=>{try{await svc.cancelTransaction(req.params.type,req.params.id,req);res.json({success:true})}catch(e){console.error(e);res.status(e.status||400).json({success:false,msg:e.message})}};
exports.transactionFinal=async(req,res)=>{try{const d=await svc.finalize(req.params.type,req.params.id,req);res.json({success:true,data:d})}catch(e){console.error(e);res.status(e.status||400).json({success:false,msg:e.message})}};

exports.stock=async(req,res)=>res.render('inventory/stock',{user:req.session.user,isAdmin:isAdmin(req),selectedStkid:selectedContext(req),stockists:await stockists()});
exports.stockData=async(req,res)=>{try{res.json({success:true,...await svc.getStock(req,Number(req.query.page||1),Math.min(100,Math.max(1,Number(req.query.limit||25))),(req.query.search||'').trim(),selectedContext(req))})}catch(e){res.status(400).json({success:false,msg:e.message})}};
exports.movement=async(req,res)=>res.render('inventory/movement',{user:req.session.user,isAdmin:isAdmin(req),selectedStkid:selectedContext(req),stockists:await stockists()});
exports.movementData=async(req,res)=>{try{res.json({success:true,data:await svc.getMovements(req,{...req.query,stkid:selectedContext(req)})})}catch(e){res.status(400).json({success:false,msg:e.message})}};
exports.pickup=async(req,res)=>res.render('inventory/pickup',{user:req.session.user,isAdmin:isAdmin(req),selectedStkid:selectedContext(req),stockists:await stockists()});
exports.pickupData=async(req,res)=>{try{res.json({success:true,...await svc.getPickupList(req,Number(req.query.page||1),Math.min(100,Math.max(1,Number(req.query.limit||20))),(req.query.search||'').trim(),selectedContext(req))})}catch(e){res.status(400).json({success:false,msg:e.message})}};
exports.pickupProcess=async(req,res)=>{try{await svc.pickup(req.params.registerno,req);res.json({success:true,msg:'Pickup berhasil diproses dan stok telah dikeluarkan.'})}catch(e){console.error(e);res.status(e.status||400).json({success:false,msg:e.message})}};
exports.pickupCancel=async(req,res)=>{
 try{
  const selected=requireStockistScope(req,req.body?.stkid||selectedContext(req));
  const result=await db.query(`UPDATE tr_kirim SET status_ambil='BATAL',status_ambil_at=NOW(),status_ambil_by=$1,updatedt=NOW(),updatenm=$1 WHERE registerno=$2 AND stkid=$3 AND status_ambil='BELUM' RETURNING registerno`,[req.session.user,req.params.registerno,selected]);
  if(!result.length) throw new Error('Pickup tidak ditemukan atau status bukan BELUM.');
  res.json({success:true});
 }catch(e){console.error(e);res.status(e.status||400).json({success:false,msg:e.message});}
};
module.exports=exports;
