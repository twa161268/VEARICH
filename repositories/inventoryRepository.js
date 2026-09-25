const db = require('../db');

const MASTER = {
  satuan: {
    table:'sb_satuan', id:'satuan_id',
    fields:['kode','nama','aktif'], order:'kode'
  },
  kategori: {
    table:'sb_kategori', id:'kategori_id',
    fields:['kode','nama','aktif'], order:'kode'
  },
  supplier: {
    table:'sb_supplier', id:'supplier_id',
    fields:['kode','nama','alamat','telp','email','aktif'], order:'kode'
  },
  gudang: {
    table:'sb_gudang', id:'gudang_id',
    fields:['kode','nama','alamat','kota','aktif','is_default','stkid'], order:'kode'
  },
  batch: {
    table:'sb_barang_batch', id:'batch_id',
    fields:['prdid','batch_no','nomor_lot','tanggal_produksi','tanggal_expired','keterangan','aktif'], order:'batch_no'
  }
};

const TX = {
  masuk: {
    header:'sb_barang_masuk', detail:'sb_barang_masuk_det', id:'masuk_id', no:'no_masuk',
    detailId:'masuk_det_id', date:'tanggal', fields:['supplier_id','keterangan'],
    detailFields:['prdid','batch_id','qty','harga','keterangan'],
    movement:'PEMBELIAN', movementSign:'IN'
  },
  keluar: {
    header:'sb_barang_keluar', detail:'sb_barang_keluar_det', id:'keluar_id', no:'no_keluar',
    detailId:'keluar_det_id', date:'tanggal', fields:['keterangan'],
    detailFields:['prdid','batch_id','qty','keterangan'],
    movement:'PENGELUARAN', movementSign:'OUT'
  },
  retur_beli: {
    header:'sb_retur_beli', detail:'sb_retur_beli_det', id:'retur_beli_id', no:'no_retur',
    detailId:'retur_beli_det_id', date:'tanggal', fields:['supplier_id','keterangan'],
    detailFields:['prdid','batch_id','qty','keterangan'],
    movement:'RETUR_BELI', movementSign:'OUT'
  },
  retur_jual: {
    header:'sb_retur_jual', detail:'sb_retur_jual_det', id:'retur_jual_id', no:'no_retur',
    detailId:'retur_jual_det_id', date:'tanggal', fields:['orderno','keterangan'],
    detailFields:['prdid','batch_id','qty','keterangan'],
    movement:'RETUR_JUAL', movementSign:'IN'
  },
  adjustment: {
    header:'sb_adjustment', detail:'sb_adjustment_det', id:'adjustment_id', no:'no_adjustment',
    detailId:'adjustment_det_id', date:'tanggal', fields:['keterangan'],
    detailFields:['prdid','batch_id','tipe','qty','keterangan'],
    movement:'ADJUSTMENT'
  },
  opname: {
    header:'sb_stock_opname', detail:'sb_stock_opname_det', id:'opname_id', no:'no_opname',
    detailId:'opname_det_id', date:'tanggal', fields:['keterangan'],
    detailFields:['prdid','batch_id','stok_sistem','stok_fisik','selisih','keterangan'],
    movement:'OPNAME'
  },
  transfer: {
    header:'sb_transfer', detail:'sb_transfer_det', id:'transfer_id', no:'no_transfer',
    detailId:'transfer_det_id', date:'tanggal', fields:['gudang_tujuan_id','keterangan'],
    detailFields:['prdid','batch_id','qty'],
    movement:'TRANSFER'
  }
};

function cfg(type){ if(!TX[type]) throw new Error('Jenis transaksi tidak dikenal'); return TX[type]; }
function masterCfg(type){ if(!MASTER[type]) throw new Error('Master tidak dikenal'); return MASTER[type]; }

async function getMaster(type, stkid = null){
  const c=masterCfg(type);
  let sql=`SELECT * FROM public.${c.table}`;
  const p=[];
  if(type==='gudang' && stkid){ sql+=` WHERE stkid=$1`; p.push(stkid); }
  sql+=` ORDER BY ${c.order}`;
  return db.query(sql,p);
}
async function createMaster(type,data,actor){
  const c=masterCfg(type);
  const fields=c.fields.filter(f=>data[f]!==undefined);
  const values=fields.map(f=>data[f]=== '' ? null : data[f]);
  const placeholders=fields.map((_,i)=>`$${i+1}`).join(',');
  return db.query(`INSERT INTO public.${c.table} (${fields.join(',')}) VALUES (${placeholders}) RETURNING *`,values);
}
async function updateMaster(type,id,data,actor){
  const c=masterCfg(type);
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');

    const current=(await client.query(
      `SELECT * FROM public.${c.table} WHERE ${c.id}=$1 FOR UPDATE`,[id]
    )).rows[0];
    if(!current) throw new Error('Data master tidak ditemukan.');

    // Field yang menjadi identitas/referensi transaksi tidak boleh diubah
    // setelah master tersebut sudah dipakai.
    if(type==='kategori' && data.kode!==undefined && String(data.kode)!==String(current.kode)){
      const used=(await client.query(
        `SELECT 1 FROM public.master_prd WHERE kode=$1 LIMIT 1`,[current.kode]
      )).rows.length;
      if(used) throw new Error(`Kode kategori ${current.kode} sudah digunakan produk dan tidak dapat diubah. Nama/Status masih boleh diubah.`);
    }

    if(type==='batch'){
      const used=(await client.query(`
        SELECT 1 FROM sb_stock_balance WHERE batch_id=$1
        UNION ALL
        SELECT 1 FROM sb_stock_movement WHERE batch_id=$1
        UNION ALL
        SELECT 1 FROM sb_barang_masuk_det WHERE batch_id=$1
        UNION ALL
        SELECT 1 FROM sb_barang_keluar_det WHERE batch_id=$1
        UNION ALL
        SELECT 1 FROM sb_retur_beli_det WHERE batch_id=$1
        UNION ALL
        SELECT 1 FROM sb_retur_jual_det WHERE batch_id=$1
        UNION ALL
        SELECT 1 FROM sb_transfer_det WHERE batch_id=$1
        UNION ALL
        SELECT 1 FROM sb_adjustment_det WHERE batch_id=$1
        UNION ALL
        SELECT 1 FROM sb_stock_opname_det WHERE batch_id=$1
        LIMIT 1
      `,[id])).rows.length;
      if(used && data.prdid!==undefined && String(data.prdid)!==String(current.prdid))
        throw new Error(`Batch ${current.batch_no} sudah digunakan transaksi dan produk batch tidak dapat diubah.`);
      if(used && data.batch_no!==undefined && String(data.batch_no)!==String(current.batch_no))
        throw new Error(`Batch ${current.batch_no} sudah digunakan transaksi dan nomor batch tidak dapat diubah.`);
    }

    const fields=c.fields.filter(f=>data[f]!==undefined && f!==c.id);
    if(!fields.length) throw new Error('Tidak ada data untuk diubah.');
    const values=fields.map(f=>data[f]===''?null:data[f]);
    values.push(id);
    const result=await client.query(
      `UPDATE public.${c.table} SET ${fields.map((f,i)=>`${f}=$${i+1}`).join(',')} WHERE ${c.id}=$${fields.length+1} RETURNING *`,
      values
    );
    await client.query('COMMIT');
    return result.rows;
  }catch(e){
    await client.query('ROLLBACK');
    throw e;
  }finally{client.release();}
}
async function deactivateMaster(type,id){
  const c=masterCfg(type);
  const deps = {
    satuan:`SELECT 1 FROM master_prd WHERE satuan_id=$1 LIMIT 1`,
    kategori:`SELECT 1 FROM master_prd WHERE kode=(SELECT kode FROM sb_kategori WHERE kategori_id=$1) LIMIT 1`,
    supplier:`SELECT 1 FROM sb_barang_masuk WHERE supplier_id=$1 UNION ALL SELECT 1 FROM sb_retur_beli WHERE supplier_id=$1 LIMIT 1`,
    gudang:`SELECT 1 FROM sb_stock_balance WHERE gudang_id=$1 UNION ALL SELECT 1 FROM sb_stock_movement WHERE gudang_id=$1 LIMIT 1`,
    batch:`SELECT 1 FROM sb_stock_balance WHERE batch_id=$1 UNION ALL SELECT 1 FROM sb_stock_movement WHERE batch_id=$1 LIMIT 1`
  };
  if(deps[type]){
    const used=await db.query(deps[type],[id]);
    if(used.length) return {blocked:true};
  }
  await db.query(`UPDATE public.${c.table} SET aktif=false WHERE ${c.id}=$1`,[id]);
  return {blocked:false};
}

async function getProducts(stkid, page=1, limit=20, search=''){
  const offset=(page-1)*limit; const p=[]; let where=`WHERE 1=1`;
  if(search){p.push(`%${search}%`); where+=` AND (prdid ILIKE $${p.length} OR prdname ILIKE $${p.length} OR COALESCE(barcode,'') ILIKE $${p.length})`;}
  const count=(await db.query(`SELECT COUNT(*)::int AS total FROM public.master_prd ${where}`,p))[0].total;
  p.push(limit,offset);
  const rows=await db.query(`
    SELECT p.*, s.nama AS satuan_nama, k.nama AS kategori_nama,
           COUNT(pt.pricecode)::int AS pricecode_count
    FROM public.master_prd p
    LEFT JOIN public.sb_satuan s ON s.satuan_id=p.satuan_id
    LEFT JOIN public.sb_kategori k ON k.kode=p.kode
    LEFT JOIN public.pricetab pt ON pt.prdid=p.prdid
    ${where}
    GROUP BY p.prdid, s.nama, k.nama
    ORDER BY p.prdid
    LIMIT $${p.length-1} OFFSET $${p.length}`,p);
  return {rows,total:count,page,limit,pages:Math.max(1,Math.ceil(count/limit))};
}

async function listTransactions(type, stkid = null, page=1, limit=20, search=''){
  const c=cfg(type), offset=(page-1)*limit, p=[], terms=[];
  if(stkid){
    p.push(stkid);
    terms.push(type==='transfer'
      ? `g.stkid=$1`
      : `g.stkid=$1`);
  }
  if(search){p.push(`%${search}%`);terms.push(`h.${c.no} ILIKE $${p.length}`);}
  const where=terms.length ? `WHERE ${terms.join(' AND ')}` : '';
  const join=type==='transfer'
    ? `JOIN sb_gudang g ON g.gudang_id=h.gudang_asal_id`
    : `JOIN sb_gudang g ON g.gudang_id=h.gudang_id`;
  const count=(await db.query(`SELECT COUNT(*)::int total FROM ${c.header} h ${join} ${where}`,p))[0].total;
  p.push(limit,offset);
  const rows=await db.query(`
    SELECT h.*,g.stkid,ms.namastk,g.nama AS gudang_nama
    FROM ${c.header} h
    ${join}
    LEFT JOIN master_stk ms ON ms.stkid=g.stkid
    ${where}
    ORDER BY h.${c.date} DESC,h.${c.id} DESC
    LIMIT $${p.length-1} OFFSET $${p.length}`,p);
  return {rows,total:count,page,limit,pages:Math.max(1,Math.ceil(count/limit))};
}

async function getTransaction(type,id,stkid=null){
  const c=cfg(type);
  const join=type==='transfer'
    ? `JOIN sb_gudang g ON g.gudang_id=h.gudang_asal_id`
    : `JOIN sb_gudang g ON g.gudang_id=h.gudang_id`;
  const params=[id];
  const scope=stkid ? ' AND g.stkid=$2' : '';
  if(stkid) params.push(stkid);
  const h=(await db.query(`
    SELECT h.*,g.stkid,ms.namastk,g.nama AS gudang_nama
    FROM ${c.header} h
    ${join}
    LEFT JOIN master_stk ms ON ms.stkid=g.stkid
    WHERE h.${c.id}=$1 ${scope}`,params))[0];
  if(!h) return null;
  const details=await db.query(`
    SELECT d.*,p.prdname,p.stock_managed,b.batch_no
    FROM ${c.detail} d JOIN master_prd p ON p.prdid=d.prdid
    LEFT JOIN sb_barang_batch b ON b.batch_id=d.batch_id
    WHERE d.${c.id}=$1 ORDER BY d.${c.detailId}`, [id]);
  return {header:h,details};
}

async function nextNo(type,client){
  const c=cfg(type);
  const prefix={masuk:'BM',keluar:'BK',retur_beli:'RB',retur_jual:'RJ',adjustment:'ADJ',opname:'OPN',transfer:'TRF'}[type];
  const yy=''; // numbering is intentionally date-independent and concurrency-safe
  const result=await client.query(`SELECT COALESCE(MAX((regexp_replace(${c.no}, '\\D', '', 'g'))::bigint),0)+1 AS n FROM ${c.header}`);
  return `${prefix}${String(result.rows[0].n).padStart(6,'0')}`;
}

module.exports={MASTER,TX,masterCfg,cfg,getMaster,createMaster,updateMaster,deactivateMaster,getProducts,listTransactions,getTransaction,nextNo};


async function getProductFormData(){
  const [kategori, satuan, pricecodes] = await Promise.all([
    db.query(`SELECT kategori_id,kode,nama,aktif FROM public.sb_kategori WHERE aktif=true ORDER BY nama`),
    db.query(`SELECT satuan_id,kode,nama,aktif FROM public.sb_satuan WHERE aktif=true ORDER BY nama`),
    db.query(`SELECT DISTINCT pricecode FROM public.pricetab WHERE pricecode IS NOT NULL ORDER BY pricecode`)
  ]);
  return { kategori, satuan, pricecodes };
}

async function getProduct(prdid){
  const products=await db.query(`
    SELECT p.*, k.nama AS kategori_nama, s.nama AS satuan_nama
    FROM public.master_prd p
    LEFT JOIN public.sb_kategori k ON k.kode=p.kode
    LEFT JOIN public.sb_satuan s ON s.satuan_id=p.satuan_id
    WHERE p.prdid=$1`,[prdid]);
  if(!products.length) return null;
  const prices=await db.query(`
    SELECT pt.prdid,pt.pricecode,pt.dp,pt.bv,pt.pin,pt.createnm,pt.createdt,pt.updatenm,pt.updatedt,
           EXISTS(
             SELECT 1 FROM public.tr_pinregdet d
             WHERE d.prdid=pt.prdid AND d.pricecode=pt.pricecode
           ) AS used_in_transaction
    FROM public.pricetab pt
    WHERE pt.prdid=$1
    ORDER BY pt.pricecode`,[prdid]);
  return {product:products[0],prices};
}

async function createProduct(client, product, prices){
  const cols=['prdid','prdname','status','createdt','createnm','updatedt','updatenm','kode','barcode','satuan_id','stok_minimum','stock_managed'];
  const vals=[product.prdid,product.prdname,product.status,new Date(),product.createnm,new Date(),product.updatenm,product.kode,product.barcode,product.satuan_id,product.stok_minimum,product.stock_managed];
  const r=await client.query(`INSERT INTO public.master_prd (${cols.join(',')}) VALUES (${vals.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,vals);
  for(const x of prices){
    await client.query(`INSERT INTO public.pricetab(prdid,pricecode,dp,bv,pin,createnm,createdt,updatenm,updatedt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [product.prdid,x.pricecode,x.dp,x.bv,x.pin,product.createnm,new Date(),product.updatenm,new Date()]);
  }
  return r.rows[0];
}

async function updateProduct(client, prdid, product, prices){
  const fields=['prdname','status','updatedt','updatenm','kode','barcode','satuan_id','stok_minimum','stock_managed'];
  const vals=[product.prdname,product.status,new Date(),product.updatenm,product.kode,product.barcode,product.satuan_id,product.stok_minimum,product.stock_managed,prdid];
  const r=await client.query(`UPDATE public.master_prd SET ${fields.map((f,i)=>`${f}=$${i+1}`).join(',')} WHERE prdid=$${vals.length} RETURNING *`,vals);
  if(!r.rows[0]) throw new Error('Produk tidak ditemukan.');

  // Pricecode yang sudah dipakai transaksi menjadi histori harga.
  // Jangan hapus atau ubah DP/BV/PIN yang sudah pernah dipakai.
  const existing=(await client.query(`
    SELECT pt.pricecode,pt.dp,pt.bv,pt.pin,
           EXISTS(
             SELECT 1 FROM public.tr_pinregdet d
             WHERE d.prdid=pt.prdid AND d.pricecode=pt.pricecode
           ) AS used
    FROM public.pricetab pt
    WHERE pt.prdid=$1
    FOR UPDATE`,[prdid])).rows;

  const incoming=new Map(prices.map(x=>[x.pricecode,x]));
  const existingMap=new Map(existing.map(x=>[x.pricecode,x]));

  for(const old of existing){
    const next=incoming.get(old.pricecode);

    if(!next){
      if(old.used){
        throw new Error(`Pricecode ${old.pricecode} sudah digunakan transaksi dan tidak dapat dihapus.`);
      }
      await client.query(
        `DELETE FROM public.pricetab WHERE prdid=$1 AND pricecode=$2`,
        [prdid,old.pricecode]
      );
      continue;
    }

    const changed =
      Number(old.dp||0)!==Number(next.dp||0) ||
      Number(old.bv||0)!==Number(next.bv||0) ||
      Number(old.pin||0)!==Number(next.pin||0);

    if(changed && old.used){
      throw new Error(`Harga Pricecode ${old.pricecode} sudah digunakan transaksi. DP/BV/PIN tidak dapat diubah.`);
    }

    if(changed){
      await client.query(`
        UPDATE public.pricetab
        SET dp=$3,bv=$4,pin=$5,updatenm=$6,updatedt=NOW()
        WHERE prdid=$1 AND pricecode=$2`,
        [prdid,old.pricecode,next.dp,next.bv,next.pin,product.updatenm]
      );
    }
  }

  // Pricecode baru boleh ditambahkan.
  for(const x of prices){
    if(existingMap.has(x.pricecode)) continue;
    await client.query(`
      INSERT INTO public.pricetab
        (prdid,pricecode,dp,bv,pin,createnm,createdt,updatenm,updatedt)
      VALUES($1,$2,$3,$4,$5,$6,NOW(),$7,NOW())`,
      [prdid,x.pricecode,x.dp,x.bv,x.pin,product.createnm,product.updatenm]
    );
  }

  return r.rows[0];
}

async function productUsage(client, prdid){
  const checks=[
    [`SELECT 1 FROM sb_stock_movement WHERE prdid=$1 LIMIT 1`,'stock movement'],
    [`SELECT 1 FROM sb_stock_balance WHERE prdid=$1 LIMIT 1`,'stock balance'],
    [`SELECT 1 FROM sb_barang_masuk_det WHERE prdid=$1 LIMIT 1`,'barang masuk'],
    [`SELECT 1 FROM sb_barang_keluar_det WHERE prdid=$1 LIMIT 1`,'barang keluar'],
    [`SELECT 1 FROM sb_retur_beli_det WHERE prdid=$1 LIMIT 1`,'retur beli'],
    [`SELECT 1 FROM sb_retur_jual_det WHERE prdid=$1 LIMIT 1`,'retur jual'],
    [`SELECT 1 FROM sb_transfer_det WHERE prdid=$1 LIMIT 1`,'transfer'],
    [`SELECT 1 FROM sb_adjustment_det WHERE prdid=$1 LIMIT 1`,'adjustment'],
    [`SELECT 1 FROM sb_stock_opname_det WHERE prdid=$1 LIMIT 1`,'stock opname'],
    [`SELECT 1 FROM tr_pinregdet WHERE prdid=$1 LIMIT 1`,'penjualan']
  ];
  for(const [sql,name] of checks){ if((await client.query(sql,[prdid])).rows.length) return name; }
  return null;
}

module.exports.getProductFormData=getProductFormData;
module.exports.getProduct=getProduct;
module.exports.createProduct=createProduct;
module.exports.updateProduct=updateProduct;
module.exports.productUsage=productUsage;
