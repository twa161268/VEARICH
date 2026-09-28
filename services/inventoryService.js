const db = require('../db');
const repo = require('../repositories/inventoryRepository');

const NUM = v => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Qty harus lebih besar dari 0.');
  return n;
};
const actorName = req => req.session.user || 'SYSTEM';

async function warehouseFor(stkid,client=db){
  if(!stkid) throw new Error('Stockist belum dipilih.');
  const r=await client.query(`
    SELECT gudang_id,kode,nama,aktif,stkid
    FROM sb_gudang
    WHERE stkid=$1 AND aktif=true
    ORDER BY is_default DESC,gudang_id
    LIMIT 1
  `,[stkid]);
  if(!r.rows[0]) throw new Error(`Gudang aktif untuk stockist ${stkid} tidak ditemukan.`);
  return r.rows[0];
}

function requestStkid(req, requested=null, required=false){
  const admin=String(req.session.role||'').toLowerCase()==='admin';
  const stkid=admin ? (requested || req.session.inventoryStkid || null) : req.session.stkid;
  if(required && !stkid) throw new Error('Stockist harus dipilih terlebih dahulu.');
  return stkid;
}

async function transactionWarehouse(client,type,id,req){
  const admin=String(req.session.role||'').toLowerCase()==='admin';
  const c=repo.cfg(type);
  if(!admin) return warehouseFor(req.session.stkid,client);
  const join=type==='transfer'
    ? `JOIN sb_gudang g ON g.gudang_id=h.gudang_asal_id`
    : `JOIN sb_gudang g ON g.gudang_id=h.gudang_id`;
  const r=await client.query(`
    SELECT h.*,g.gudang_id,g.stkid,g.aktif
    FROM ${c.header} h ${join}
    WHERE h.${c.id}=$1
    FOR UPDATE`,[id]);
  const row=r.rows[0];
  if(!row) throw new Error('Transaksi tidak ditemukan.');
  if(!row.aktif) throw new Error('Gudang transaksi tidak aktif.');
  return row;
}

async function validateTransferDestination(client, sourceWarehouse, destinationId, req){
  const dest=(await client.query(`
    SELECT gudang_id,kode,nama,aktif,stkid
    FROM sb_gudang
    WHERE gudang_id=$1 AND aktif=true
  `,[destinationId])).rows[0];

  if(!dest){
    const err=new Error('Gudang tujuan tidak valid atau tidak aktif.');
    err.status=422;
    throw err;
  }
  if(Number(dest.gudang_id)===Number(sourceWarehouse.gudang_id)){
    const err=new Error('Gudang asal dan tujuan tidak boleh sama.');
    err.status=422;
    throw err;
  }

  const admin=String(req.session.role||'').toLowerCase()==='admin';
  if(!admin && String(dest.stkid)!==String(sourceWarehouse.stkid)){
    const err=new Error('Transfer antar stockist hanya dapat dilakukan oleh ADMIN.');
    err.status=403;
    throw err;
  }
  return dest;
}

async function validateProductBatch(client, d){
  const p=(await client.query(`SELECT prdid, prdname, stock_managed FROM master_prd WHERE prdid=$1`,[d.prdid])).rows[0];
  if(!p) throw new Error(`Produk ${d.prdid} tidak ditemukan.`);
  if(!p.stock_managed) throw new Error(`Produk ${p.prdname || d.prdid} tidak dikelola sebagai inventory.`);
  if(d.batch_id){
    const b=(await client.query(`SELECT batch_id, prdid, aktif, tanggal_expired FROM sb_barang_batch WHERE batch_id=$1`,[d.batch_id])).rows[0];
    if(!b || b.prdid!==p.prdid) throw new Error(`Batch tidak sesuai dengan produk ${p.prdname || p.prdid}.`);
    if(!b.aktif) throw new Error('Batch tidak aktif.');
  }
  return p;
}
async function lockBalance(client, prdid,gudang_id,batch_id,create=true){
  let q=`SELECT balance_id,qty FROM sb_stock_balance WHERE prdid=$1 AND gudang_id=$2 AND `;
  q += batch_id ? `batch_id=$3` : `batch_id IS NULL`;
  const params=batch_id?[prdid,gudang_id,batch_id]:[prdid,gudang_id];
  let r=await client.query(q+` FOR UPDATE`,params);
  if(!r.rows[0] && create){
    const ins=await client.query(
      `INSERT INTO sb_stock_balance(prdid,batch_id,gudang_id,qty,updated_at) VALUES($1,$2,$3,0,NOW()) RETURNING balance_id,qty`,
      [prdid,batch_id||null,gudang_id]);
    r=await client.query(q+` FOR UPDATE`,params);
  }
  return r.rows[0] || {balance_id:null,qty:0};
}
async function changeBalance(client,prdid,gudang_id,batch_id,delta){
  const b=await lockBalance(client,prdid,gudang_id,batch_id,true);
  const next=Number(b.qty)+Number(delta);
  if(next < -1e-9) throw new Error('Stok tidak mencukupi.');
  await client.query(`UPDATE sb_stock_balance SET qty=$1, updated_at=NOW() WHERE balance_id=$2`,[next,b.balance_id]);
  return next;
}
async function movement(client,{prdid,batch_id,gudang_id,tipe,ref_table,ref_id,ref_no,qty_in=0,qty_out=0,keterangan,created_by}){
  await client.query(`INSERT INTO sb_stock_movement
    (tanggal,prdid,batch_id,gudang_id,tipe,ref_table,ref_id,ref_no,qty_in,qty_out,keterangan,created_by,created_at)
    VALUES(NOW(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
    [prdid,batch_id||null,gudang_id,tipe,ref_table,ref_id,ref_no,qty_in,qty_out,keterangan||null,created_by||'SYSTEM']);
}
async function begin(client){ await client.query('BEGIN'); await client.query(`SELECT pg_advisory_xact_lock(hashtext('inventory-document-number'))`); }

async function createTransaction(type,req){
  const c=repo.cfg(type), actor=actorName(req), body=req.body||{}, stkid=requestStkid(req, body.stkid, true);
  if(!stkid) throw new Error('Session stockist tidak tersedia.');
  const details=Array.isArray(body.details)?body.details:[];
  if(!details.length) throw new Error('Detail transaksi minimal 1 item.');
  const client=await db.pool.connect();
  try{
    await begin(client);
    const wh=await warehouseFor(stkid,client);
    let dest=null;
    if(type==='transfer'){
      dest=await validateTransferDestination(client,wh,body.gudang_tujuan_id,req);
    }
    const no=await repo.nextNo(type,client);
    // gudang_id / gudang_asal_id adalah NOT NULL pada tabel transaksi.
    // Karena gudang ditentukan server dari stockist, nilainya harus dimasukkan
    // langsung saat INSERT, bukan diisi setelah INSERT.
    const warehouseField = type==='transfer' ? 'gudang_asal_id' : 'gudang_id';
    const headerFields=[c.no,c.date,...c.fields,warehouseField,'status','created_by','created_at','updated_at'];
    const headerVals=[no,body.tanggal||new Date(),...c.fields.map(f=>body[f]===''?null:body[f]),wh.gudang_id,'DRAFT',actor,new Date(),new Date()];
    const hres=await client.query(`INSERT INTO ${c.header}(${headerFields.join(',')}) VALUES(${headerVals.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,headerVals);
    const h=hres.rows[0];
    for(const d0 of details){
      const d={...d0}; d.qty=NUM(d.qty);
      if(type==='adjustment' && !['IN','OUT'].includes(String(d.tipe).toUpperCase())) throw new Error('Tipe adjustment hanya IN atau OUT.');
      await validateProductBatch(client,d);
      if(type==='opname'){
        const bal=await client.query(
          `SELECT qty FROM sb_stock_balance WHERE prdid=$1 AND gudang_id=$2 AND ${d.batch_id ? 'batch_id=$3' : 'batch_id IS NULL'}`,
          d.batch_id ? [d.prdid,wh.gudang_id,d.batch_id] : [d.prdid,wh.gudang_id]
        );
        d.stok_sistem=Number(bal.rows[0]?.qty || 0);
        d.stok_fisik=Number(d.stok_fisik ?? 0);
        if(d.stok_fisik < 0) throw new Error('Stok fisik tidak boleh negatif.');
        d.selisih=d.stok_fisik-d.stok_sistem;
      }
      if(type==='masuk'){ d.harga=Number(d.harga||0); }
      const fields=c.detailFields;
      const vals=fields.map(f=>d[f]===undefined||d[f]===''?null:d[f]);
      vals.push(h[c.id]);
      const cols=[...fields,c.id];
      await client.query(`INSERT INTO ${c.detail}(${cols.join(',')}) VALUES(${vals.map((_,i)=>`$${i+1}`).join(',')})`,vals);
    }
    await client.query('COMMIT');
    return await repo.getTransaction(type,h[c.id],stkid);
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}
}

async function updateTransaction(type,id,req){
  const c=repo.cfg(type), actor=actorName(req), body=req.body||{}, details=Array.isArray(body.details)?body.details:[];
  const client=await db.pool.connect();
  try{
    await begin(client);
    const wh=await transactionWarehouse(client,type,id,req);
    const cond=type==='transfer'?`gudang_asal_id=$1`:`gudang_id=$1`;
    const params=[id,wh.gudang_id];
    const h=(await client.query(`SELECT * FROM ${c.header} WHERE ${c.id}=$1 AND ${cond.replace('$1','$2')} FOR UPDATE`,params)).rows[0];
    if(!h) throw new Error('Transaksi tidak ditemukan atau bukan milik stockist Anda.');
    if(h.status!=='DRAFT') throw new Error('Transaksi FINAL/CANCEL tidak dapat diedit.');
    if(!details.length) throw new Error('Detail transaksi minimal 1 item.');
    if(String(req.session.role||'').toLowerCase()==='admin' && body.stkid && body.stkid!==wh.stkid)
      throw new Error('Stockist transaksi tidak boleh diubah saat edit.');

    if(type==='transfer'){
      await validateTransferDestination(client,wh,body.gudang_tujuan_id,req);
    }
    const updates=[c.date,...c.fields].filter(f=>body[f]!==undefined);
    if(updates.length){
      const vals=updates.map(f=>body[f]===''?null:body[f]);
      vals.push(new Date(),id);
      await client.query(`UPDATE ${c.header} SET ${updates.map((f,i)=>`${f}=$${i+1}`).join(',')},updated_at=$${vals.length-1} WHERE ${c.id}=$${vals.length}`,vals);
    }
    await client.query(`DELETE FROM ${c.detail} WHERE ${c.id}=$1`,[id]);
    for(const d0 of details){
      const d={...d0}; d.qty=NUM(d.qty);
      if(type==='adjustment'&&!['IN','OUT'].includes(String(d.tipe).toUpperCase())) throw new Error('Tipe adjustment hanya IN atau OUT.');
      await validateProductBatch(client,d);
      if(type==='masuk'){d.harga=Number(d.harga||0);}
      if(type==='opname'){d.stok_sistem=Number(d.stok_sistem||0);d.stok_fisik=Number(d.stok_fisik||0);d.selisih=d.stok_fisik-d.stok_sistem;}
      const vals=c.detailFields.map(f=>d[f]===undefined||d[f]===''?null:d[f]); vals.push(id);
      await client.query(`INSERT INTO ${c.detail}(${[...c.detailFields,c.id].join(',')}) VALUES(${vals.map((_,i)=>`$${i+1}`).join(',')})`,vals);
    }
    if(type==='transfer') await client.query(`UPDATE ${c.header} SET gudang_tujuan_id=$1 WHERE ${c.id}=$2`,[body.gudang_tujuan_id,id]);
    await client.query('COMMIT');
    return repo.getTransaction(type,id,wh.stkid);
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}
}

async function deleteTransaction(type,id,req){
  const c=repo.cfg(type), client=await db.pool.connect();
  try{
    await begin(client);
    const wh=await transactionWarehouse(client,type,id,req);
    const cond=type==='transfer'?`gudang_asal_id=$1`:`gudang_id=$1`;
    const h=(await client.query(`SELECT * FROM ${c.header} WHERE ${c.id}=$1 AND ${cond.replace('$1','$2')} FOR UPDATE`,[id,wh.gudang_id])).rows[0];
    if(!h) throw new Error('Transaksi tidak ditemukan.');
    if(h.status!=='DRAFT') throw new Error('Hanya transaksi DRAFT yang boleh dihapus.');
    await client.query(`DELETE FROM ${c.detail} WHERE ${c.id}=$1`,[id]);
    await client.query(`DELETE FROM ${c.header} WHERE ${c.id}=$1`,[id]);
    await client.query('COMMIT'); return true;
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}
}

async function cancelTransaction(type,id,req){
  const c=repo.cfg(type), client=await db.pool.connect();
  try{
    await begin(client);
    const wh=await transactionWarehouse(client,type,id,req);
    const cond=type==='transfer'?`gudang_asal_id=$1`:`gudang_id=$1`;
    const h=(await client.query(`SELECT * FROM ${c.header} WHERE ${c.id}=$1 AND ${cond.replace('$1','$2')} FOR UPDATE`,[id,wh.gudang_id])).rows[0];
    if(!h) throw new Error('Transaksi tidak ditemukan.');
    if(h.status!=='DRAFT') throw new Error('Hanya DRAFT yang dapat dibatalkan.');
    await client.query(`UPDATE ${c.header} SET status='CANCEL',updated_at=NOW() WHERE ${c.id}=$1`,[id]);
    await client.query('COMMIT'); return true;
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}
}

async function finalize(type,id,req){
  const c=repo.cfg(type), actor=actorName(req), client=await db.pool.connect();
  try{
    await begin(client);
    const wh=await transactionWarehouse(client,type,id,req);
    const cond=type==='transfer'?`h.gudang_asal_id=$1`:`h.gudang_id=$1`;
    const h=(await client.query(`SELECT h.* FROM ${c.header} h WHERE h.${c.id}=$2 AND ${cond} FOR UPDATE`,[wh.gudang_id,id])).rows[0];
    if(!h) throw new Error('Transaksi tidak ditemukan atau bukan milik stockist Anda.');
    if(h.status!=='DRAFT') throw new Error(`Transaksi sudah ${h.status}.`);
    const ds=(await client.query(`SELECT d.*,p.stock_managed FROM ${c.detail} d JOIN master_prd p ON p.prdid=d.prdid WHERE d.${c.id}=$1 ORDER BY d.${c.detailId}`,[id])).rows;
    if(!ds.length) throw new Error('Transaksi tidak memiliki detail.');
    let dest=null;
    if(type==='transfer'){
      dest=await validateTransferDestination(client,wh,h.gudang_tujuan_id,req);
    }
    for(const d of ds){
      await validateProductBatch(client,d);
      const qty=Number(d.qty);
      if(type==='opname'){
        const bal=await lockBalance(client,d.prdid,wh.gudang_id,d.batch_id,true);
        const current=Number(bal.qty), physical=Number(d.stok_fisik), delta=physical-current;
        if(delta!==0){
          await changeBalance(client,d.prdid,wh.gudang_id,d.batch_id,delta);
          await movement(client,{prdid:d.prdid,batch_id:d.batch_id,gudang_id:wh.gudang_id,tipe:'OPNAME',ref_table:c.header,ref_id:id,ref_no:h[c.no],qty_in:delta>0?delta:0,qty_out:delta<0?-delta:0,keterangan:d.keterangan,created_by:actor});
        }
        continue;
      }
      if(type==='transfer'){
        await changeBalance(client,d.prdid,wh.gudang_id,d.batch_id,-qty);
        await movement(client,{prdid:d.prdid,batch_id:d.batch_id,gudang_id:wh.gudang_id,tipe:'TRANSFER_OUT',ref_table:c.header,ref_id:id,ref_no:h[c.no],qty_out:qty,keterangan:h.keterangan,created_by:actor});
        await changeBalance(client,d.prdid,dest.gudang_id,d.batch_id,qty);
        await movement(client,{prdid:d.prdid,batch_id:d.batch_id,gudang_id:dest.gudang_id,tipe:'TRANSFER_IN',ref_table:c.header,ref_id:id,ref_no:h[c.no],qty_in:qty,keterangan:h.keterangan,created_by:actor});
      } else {
        let delta=0,qin=0,qout=0;
        if(type==='masuk'||type==='retur_jual'){delta=qty;qin=qty;}
        else if(type==='keluar'||type==='retur_beli'){delta=-qty;qout=qty;}
        else if(type==='adjustment'){
          if(String(d.tipe).toUpperCase()==='IN'){delta=qty;qin=qty;}else{delta=-qty;qout=qty;}
        }
        await changeBalance(client,d.prdid,wh.gudang_id,d.batch_id,delta);
        await movement(client,{prdid:d.prdid,batch_id:d.batch_id,gudang_id:wh.gudang_id,tipe:c.movement,ref_table:c.header,ref_id:id,ref_no:h[c.no],qty_in:qin,qty_out:qout,keterangan:d.keterangan||h.keterangan,created_by:actor});
      }
    }
    if(type==='opname'){
      for(const d of ds) await client.query(`UPDATE ${c.detail} SET selisih=stok_fisik-stok_sistem WHERE ${c.detailId}=$1`,[d[c.detailId]]);
    }
    await client.query(`UPDATE ${c.header} SET status='FINAL',finalized_by=$1,finalized_at=NOW(),updated_at=NOW() WHERE ${c.id}=$2`,[actor,id]);
    await client.query('COMMIT');
    return repo.getTransaction(type,id,wh.stkid);
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}
}

async function pickup(registerno,req){
  const client=await db.pool.connect(), actor=actorName(req);
  try{
    await begin(client);
    const admin=String(req.session.role||'').toLowerCase()==='admin';
    const selected=requestStkid(req,req.body?.stkid, true);
    const wh=await warehouseFor(selected,client);
    const h=(await client.query(`SELECT * FROM tr_kirim WHERE registerno=$1 AND stkid=$2 FOR UPDATE`,[registerno,selected])).rows[0];
    if(!h) throw new Error('Registrasi pengambilan tidak ditemukan untuk stockist yang dipilih.');
    if(h.status_ambil!=='BELUM') throw new Error(`Status pengambilan sudah ${h.status_ambil}.`);
    const orders=(await client.query(`SELECT orderno,stbayar,stkid FROM tr_pinreg WHERE registerno=$1 ORDER BY orderno`,[registerno])).rows;
    if(!orders.length) throw new Error('Tidak ada order pada registrasi ini.');
    if(orders.some(o=>o.stkid!==selected)) throw new Error('Terdapat order dengan stockist yang tidak sesuai.');
    if(orders.some(o=>!o.stbayar)) throw new Error('Semua order dalam registrasi belum lunas.');
    const ordernos=orders.map(o=>o.orderno);
    // Pricecode diambil dari header tr_pinreg, bukan dari param aktif saat pickup.
    // Dengan demikian transaksi lama tetap menggunakan pricecode saat transaksi dibuat.
    const ds=(await client.query(`
      SELECT
        d.orderno,
        d.prdid,
        d.qty,
        d.pin,
        r.pricecode,
        p.stock_managed
      FROM tr_pinregdet d
      JOIN tr_pinreg r ON r.orderno=d.orderno
      JOIN master_prd p ON p.prdid=d.prdid
      WHERE d.orderno=ANY($1::varchar[])
      ORDER BY d.orderno
    `,[ordernos])).rows;
    if(!ds.length) throw new Error('Detail produk penjualan tidak ditemukan.');

    for(const d of ds){
      const qty=NUM(d.qty);

      // Jika produk merupakan paket/bundling, stok yang dikurangi adalah
      // komponen fisiknya berdasarkan master_pak + pricecode transaksi.
      const pak=(await client.query(`
        SELECT mp.prdid, mp.qty, p.prdname, p.stock_managed
        FROM master_pak mp
        JOIN master_prd p ON p.prdid=mp.prdid
        WHERE mp.prdidcat=$1
          AND mp.pricecode=$2
        ORDER BY mp.prdid
      `,[d.prdid,d.pricecode])).rows;

      if(pak.length){
        for(const item of pak){
          if(!item.stock_managed) continue;
          const componentQty=qty*NUM(item.qty);

          await changeBalance(
            client,
            item.prdid,
            wh.gudang_id,
            null,
            -componentQty
          );

          await movement(client,{
            prdid:item.prdid,
            gudang_id:wh.gudang_id,
            tipe:'PENJUALAN',
            ref_table:'tr_kirim',
            ref_id:null,
            ref_no:registerno,
            qty_out:componentQty,
            keterangan:`Pickup ${registerno} - ${d.prdid} x ${qty}`,
            created_by:actor
          });
        }
      } else {
        // Produk biasa: tetap gunakan perilaku lama.
        if(!d.stock_managed) continue;

        await changeBalance(
          client,
          d.prdid,
          wh.gudang_id,
          null,
          -qty
        );

        await movement(client,{
          prdid:d.prdid,
          gudang_id:wh.gudang_id,
          tipe:'PENJUALAN',
          ref_table:'tr_kirim',
          ref_id:null,
          ref_no:registerno,
          qty_out:qty,
          keterangan:`Pickup ${registerno}`,
          created_by:actor
        });
      }
    }
    await client.query(`UPDATE tr_kirim SET status_ambil='DIAMBIL',status_ambil_at=NOW(),status_ambil_by=$1,updatedt=NOW(),updatenm=$1 WHERE registerno=$2 AND stkid=$3`,[actor,registerno,selected]);
    await client.query('COMMIT'); return true;
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}
}

async function getPickupList(req,page=1,limit=20,search='',selectedStkid=null){
  const stkid=requestStkid(req,selectedStkid,false);
  const offset=(page-1)*limit,p=[],terms=[`k.status_ambil='BELUM'`];
  if(stkid){p.push(stkid);terms.push(`k.stkid=$${p.length}`);}
  if(search){p.push(`%${search}%`);terms.push(`k.registerno ILIKE $${p.length}`);}
  const where=terms.join(' AND ');
  const count=(await db.query(`SELECT COUNT(*)::int total FROM tr_kirim k WHERE ${where}`,p))[0].total;
  p.push(limit,offset);
  const rows=await db.query(`SELECT k.registerno,k.stkid,ms.namastk,k.namakirim,k.tamount,k.tpin,k.status_ambil,k.createdt,
    COUNT(r.orderno)::int order_count,BOOL_AND(r.stbayar) AS all_paid
    FROM tr_kirim k LEFT JOIN tr_pinreg r ON r.registerno=k.registerno
    LEFT JOIN master_stk ms ON ms.stkid=k.stkid
    WHERE ${where}
    GROUP BY k.registerno,ms.namastk
    ORDER BY k.createdt DESC NULLS LAST LIMIT $${p.length-1} OFFSET $${p.length}`,p);
  return {rows,total:count,page,limit,pages:Math.max(1,Math.ceil(count/limit))};
}

async function getStock(req,page=1,limit=25,search='',selectedStkid=null){
  const stkid=requestStkid(req,selectedStkid,false), offset=(page-1)*limit,p=[],terms=[];
  if(stkid){p.push(stkid);terms.push(`g.stkid=$${p.length}`);}
  if(search){p.push(`%${search}%`);terms.push(`(p.prdid ILIKE $${p.length} OR p.prdname ILIKE $${p.length} OR COALESCE(p.barcode,'') ILIKE $${p.length} OR COALESCE(b.batch_no,'') ILIKE $${p.length})`);}
  const where=terms.length?`WHERE ${terms.join(' AND ')}`:'';
  const count=(await db.query(`SELECT COUNT(*)::int total FROM sb_stock_balance sb JOIN sb_gudang g ON g.gudang_id=sb.gudang_id JOIN master_prd p ON p.prdid=sb.prdid LEFT JOIN sb_barang_batch b ON b.batch_id=sb.batch_id ${where}`,p))[0].total;
  p.push(limit,offset);
  const rows=await db.query(`SELECT sb.*,p.prdname,p.barcode,s.nama satuan_nama,b.batch_no,b.nomor_lot,b.tanggal_expired,g.nama gudang_nama,g.stkid,ms.namastk,p.stok_minimum
    FROM sb_stock_balance sb JOIN sb_gudang g ON g.gudang_id=sb.gudang_id JOIN master_prd p ON p.prdid=sb.prdid
    LEFT JOIN sb_satuan s ON s.satuan_id=p.satuan_id LEFT JOIN sb_barang_batch b ON b.batch_id=sb.batch_id
    LEFT JOIN master_stk ms ON ms.stkid=g.stkid
    ${where} ORDER BY ms.namastk,p.prdname,b.batch_no LIMIT $${p.length-1} OFFSET $${p.length}`,p);
  return {rows,total:count,page,limit,pages:Math.max(1,Math.ceil(count/limit))};
}

async function getMovements(req,filters={}){
  const stkid=requestStkid(req,filters.stkid || null,false),p=[],terms=[];
  if(stkid){p.push(stkid);terms.push(`g.stkid=$${p.length}`);}
  if(filters.prdid){p.push(filters.prdid);terms.push(`m.prdid=$${p.length}`);}
  if(filters.tipe){p.push(filters.tipe);terms.push(`m.tipe=$${p.length}`);}
  if(filters.from){p.push(filters.from);terms.push(`m.tanggal >= $${p.length}`);}
  if(filters.to){p.push(filters.to);terms.push(`m.tanggal < ($${p.length}::date + INTERVAL '1 day')`);}
  const where=terms.length?`WHERE ${terms.join(' AND ')}`:'';
  const rows=await db.query(`SELECT m.*,p.prdname,p.barcode,b.batch_no,g.nama gudang_nama,g.stkid,ms.namastk
    FROM sb_stock_movement m JOIN sb_gudang g ON g.gudang_id=m.gudang_id JOIN master_prd p ON p.prdid=m.prdid
    LEFT JOIN sb_barang_batch b ON b.batch_id=m.batch_id LEFT JOIN master_stk ms ON ms.stkid=g.stkid
    ${where} ORDER BY m.tanggal,m.movement_id`,p);
  return rows;
}

async function getDashboard(req, selectedStkid=null){
 const stkid=requestStkid(req,selectedStkid,false),p=[],whereParts=[];
 if(stkid){p.push(stkid);whereParts.push(`g.stkid=$${p.length}`);}
 const where=whereParts.length?`AND ${whereParts.join(' AND ')}`:'';
 const stock=(await db.query(`SELECT COALESCE(SUM(sb.qty),0) qty,COUNT(DISTINCT sb.prdid)::int products
   FROM sb_stock_balance sb JOIN sb_gudang g ON g.gudang_id=sb.gudang_id WHERE 1=1 ${where}`,p))[0];
 const minimum=(await db.query(`SELECT COUNT(*)::int total FROM sb_stock_balance sb JOIN sb_gudang g ON g.gudang_id=sb.gudang_id JOIN master_prd p ON p.prdid=sb.prdid WHERE sb.qty<=p.stok_minimum ${where}`,p))[0].total;
 const expired=(await db.query(`SELECT COUNT(*)::int total FROM sb_stock_balance sb JOIN sb_gudang g ON g.gudang_id=sb.gudang_id JOIN sb_barang_batch b ON b.batch_id=sb.batch_id WHERE b.tanggal_expired IS NOT NULL AND b.tanggal_expired<=CURRENT_DATE+INTERVAL '30 days' ${where}`,p))[0].total;
 const draft=(await db.query(`SELECT COUNT(*)::int total FROM (
   SELECT h.gudang_id FROM sb_barang_masuk h WHERE h.status='DRAFT'
   UNION ALL SELECT h.gudang_id FROM sb_barang_keluar h WHERE h.status='DRAFT'
   UNION ALL SELECT h.gudang_id FROM sb_retur_beli h WHERE h.status='DRAFT'
   UNION ALL SELECT h.gudang_id FROM sb_retur_jual h WHERE h.status='DRAFT'
   UNION ALL SELECT h.gudang_id FROM sb_adjustment h WHERE h.status='DRAFT'
   UNION ALL SELECT h.gudang_id FROM sb_stock_opname h WHERE h.status='DRAFT'
   UNION ALL SELECT h.gudang_asal_id FROM sb_transfer h WHERE h.status='DRAFT'
 ) x JOIN sb_gudang g ON g.gudang_id=x.gudang_id WHERE 1=1 ${where}`,p))[0].total;
 const pp=[]; const pickupWhere=stkid ? `WHERE stkid=$1 AND status_ambil='BELUM'` : `WHERE status_ambil='BELUM'`;
 if(stkid) pp.push(stkid);
 const pickup=(await db.query(`SELECT COUNT(*)::int total FROM tr_kirim ${pickupWhere}`,pp))[0].total;
 return {stock,mminimum:minimum,expired,draft,pickup};
}

module.exports={getDashboard,createTransaction,updateTransaction,deleteTransaction,cancelTransaction,finalize,pickup,getPickupList,getStock,getMovements,warehouseFor};

function productText(v, field, max){
  const x=String(v ?? '').trim();
  if(!x) throw new Error(`${field} wajib diisi.`);
  if(x.length>max) throw new Error(`${field} maksimal ${max} karakter.`);
  return x;
}
function boolValue(v, field){
  if(v===true || v==='true' || v==='1' || v==='on') return true;
  if(v===false || v==='false' || v==='0' || v===undefined || v===null || v==='') return false;
  throw new Error(`${field} tidak valid.`);
}
function moneyValue(v, field, allowNull=true){
  if((v===undefined || v===null || v==='') && allowNull) return null;
  const n=Number(v);
  if(!Number.isFinite(n) || n<0) throw new Error(`${field} harus berupa angka >= 0.`);
  return n;
}
async function validateProductInput(client, body, isEdit=false, originalPrdid=null){
  const prdid=productText(body.prdid,'Kode Produk',10);
  if(!isEdit || prdid!==originalPrdid){
    const dup=await client.query(`SELECT 1 FROM master_prd WHERE prdid=$1`,[prdid]);
    if(dup.rows.length) throw new Error(`Kode Produk ${prdid} sudah digunakan.`);
  }
  const prdname=productText(body.prdname,'Nama Produk',30);
  const kode=productText(body.kode,'Kategori',20);
  const barcode=String(body.barcode ?? '').trim();
  if(barcode.length>50) throw new Error('Barcode maksimal 50 karakter.');
  const satuanId=Number(body.satuan_id);
  if(!Number.isInteger(satuanId) || satuanId<=0) throw new Error('Satuan wajib dipilih.');
  const stokMinimum=Number(body.stok_minimum ?? 0);
  if(!Number.isFinite(stokMinimum) || stokMinimum<0) throw new Error('Stok Minimum harus berupa angka >= 0.');
  const status=boolValue(body.status,'Status');
  const stockManaged=boolValue(body.stock_managed,'Stock Managed');
  const cat=await client.query(`SELECT 1 FROM sb_kategori WHERE kode=$1 AND aktif=true`,[kode]);
  if(!cat.rows.length) throw new Error('Kategori tidak valid atau tidak aktif.');
  const sat=await client.query(`SELECT 1 FROM sb_satuan WHERE satuan_id=$1 AND aktif=true`,[satuanId]);
  if(!sat.rows.length) throw new Error('Satuan tidak valid atau tidak aktif.');
  const raw=Array.isArray(body.prices)?body.prices:[];
  const prices=[]; const seen=new Set();
  for(const row of raw){
    const pricecode=String(row?.pricecode ?? '').trim();
    const empty=!pricecode && [row?.dp,row?.bv,row?.pin].every(v=>v===undefined||v===null||v==='');
    if(empty) continue;
    if(!pricecode) throw new Error('Pricecode wajib diisi.');
    if(pricecode.length>4) throw new Error(`Pricecode ${pricecode} maksimal 4 karakter.`);
    if(seen.has(pricecode)) throw new Error(`Pricecode ${pricecode} duplikat.`);
    seen.add(pricecode);
    prices.push({pricecode,dp:moneyValue(row.dp,'DP'),bv:moneyValue(row.bv,'BV'),pin:moneyValue(row.pin,'PIN')});
  }
  return {product:{prdid,prdname,status,kode,barcode:barcode||null,satuan_id:satuanId,stok_minimum:stokMinimum,stock_managed:stockManaged},prices};
}
async function createProduct(req){
  const actor=actorName(req), client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const {product,prices}=await validateProductInput(client,req.body||{});
    product.createnm=actor; product.updatenm=actor;
    await repo.createProduct(client,product,prices);
    await client.query('COMMIT');
    return repo.getProduct(product.prdid);
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}
}
async function updateProduct(req){
  const actor=actorName(req), prdid=String(req.params.prdid||'').trim(), client=await db.pool.connect();
  if(!prdid) throw new Error('Kode Produk tidak valid.');
  try{
    await client.query('BEGIN');
    const existing=await client.query(`SELECT prdid FROM master_prd WHERE prdid=$1 FOR UPDATE`,[prdid]);
    if(!existing.rows.length) throw new Error('Produk tidak ditemukan.');
    const body={...(req.body||{}),prdid};
    const {product,prices}=await validateProductInput(client,body,true,prdid);
    product.createnm=actor; product.updatenm=actor;
    await repo.updateProduct(client,prdid,product,prices);
    await client.query('COMMIT');
    return repo.getProduct(prdid);
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}
}
async function deactivateProduct(req){
  const prdid=String(req.params.prdid||'').trim();
  if(!prdid) throw new Error('Kode Produk tidak valid.');
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const usage=await repo.productUsage(client,prdid);
    if(usage){
      await client.query(`UPDATE master_prd SET status=false,updatedt=NOW(),updatenm=$1 WHERE prdid=$2`,[actorName(req),prdid]);
      await client.query('COMMIT');
      return {deactivated:true,reason:`Produk sudah digunakan pada ${usage}.`};
    }
    await client.query(`DELETE FROM public.pricetab WHERE prdid=$1`,[prdid]);
    const r=await client.query(`DELETE FROM public.master_prd WHERE prdid=$1 RETURNING prdid`,[prdid]);
    if(!r.rows.length) throw new Error('Produk tidak ditemukan.');
    await client.query('COMMIT');
    return {deleted:true};
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}
}

module.exports.createProduct=createProduct;
module.exports.updateProduct=updateProduct;
module.exports.deactivateProduct=deactivateProduct;
module.exports.validateProductInput=validateProductInput;
