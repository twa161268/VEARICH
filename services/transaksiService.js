const db = require('../db');
const repo = require('../repositories/transaksiRepository');

function fail(message,status=422){ const e=new Error(message); e.status=status; throw e; }
function clean(v){ if(v===undefined||v===null) return null; const s=String(v).trim(); return s||null; }

function money(v,name){
  if(v===undefined||v===null||v==='') return 0;
  const raw=String(v).trim().replace(/[^0-9.,-]/g,'');
  if(!raw) fail(`${name} tidak valid.`);
  let nraw=raw;
  const c=nraw.lastIndexOf(','), d=nraw.lastIndexOf('.');
  if(c>=0&&d>=0){
    nraw=c>d?nraw.replace(/\./g,'').replace(',','.'):nraw.replace(/,/g,'');
  }else if(d>=0){
    const parts=nraw.split('.');
    nraw=parts.length>1&&parts.slice(1).every(x=>x.length===3)?parts.join(''):nraw;
  }else if(c>=0){
    const parts=nraw.split(',');
    nraw=parts.length>1&&parts.slice(1).every(x=>x.length===3)?parts.join(''):nraw.replace(',','.');
  }
  const n=Number(nraw);
  if(!Number.isFinite(n)||n<0) fail(`${name} tidak valid.`);
  return n;
}

function normalizeBody(body,pricecode){
  if(!body||!Array.isArray(body.transactions)||!body.transactions.length)
    fail('Minimal satu transaksi PIN harus diisi.');
  const txs=body.transactions.map((t,i)=>{
    const row=i+1;
    if(!clean(t.nama)) fail(`Transaksi PIN #${row}: Nama wajib diisi.`);
    if(!Array.isArray(t.details)||!t.details.length) fail(`Transaksi PIN #${row}: minimal satu produk.`);
    const seen=new Set();
    const details=t.details.map((d,j)=>{
      const prdid=clean(d.prdid);
      const qty=Number(d.qty);
      if(!prdid) fail(`Transaksi PIN #${row}, produk #${j+1}: produk wajib dipilih.`);
      if(!Number.isInteger(qty)||qty<=0) fail(`Transaksi PIN #${row}, produk #${j+1}: qty harus integer positif.`);
      if(seen.has(prdid)) fail(`Transaksi PIN #${row}: produk yang sama tidak boleh dipilih dua kali.`);
      seen.add(prdid);
      return {prdid,qty};
    });
    return {
      orderno: clean(t.orderno),
      nama:clean(t.nama),nohp:clean(t.nohp),usernamesp:clean(t.usernamesp),namasp:clean(t.namasp),
      details
    };
  });

  const kirim=body.kirim===true||body.kirim==='true'||body.kirim===1||body.kirim==='1';
  const ongkir=kirim?money(body.ongkir,'Ongkos kirim'):0;
  if(kirim){
    ['alamat','kelurahan','kecamatan','wilayah','kota','kodepos'].forEach(f=>{
      if(!clean(body[f])) fail(`${f[0].toUpperCase()+f.slice(1)} wajib diisi jika Kirim Barang = Ya.`);
    });
  }
  const payments=Array.isArray(body.payments)?body.payments:[];
  if(!payments.length) fail('Minimal satu pembayaran harus diisi.');
  const seenPay=new Set();
  const cleanPayments=payments.map((p,i)=>{
    const paytype=clean(p.paytype);
    if(!paytype) fail(`Pembayaran #${i+1}: paytype wajib dipilih.`);
    if(seenPay.has(paytype)) fail(`Paytype ${paytype} tidak boleh dimasukkan dua kali.`);
    seenPay.add(paytype);
    const amount=money(p.amount,`Amount pembayaran #${i+1}`);
    if(amount<=0) fail(`Amount pembayaran #${i+1} harus lebih besar dari 0.`);
    return {paytype,amount,catatan:clean(p.catatan)};
  });
  return {
    transactions:txs,kirim,ongkir,
    alamat:clean(body.alamat),kelurahan:clean(body.kelurahan),kecamatan:clean(body.kecamatan),
    wilayah:clean(body.wilayah),kota:clean(body.kota),kodepos:clean(body.kodepos),
    payments:cleanPayments,pricecode
  };
}

async function hydrateTransactions(client,input){
  let totalDp=0,totalPin=0,totalBv=0;
  for(const tx of input.transactions){
    for(const d of tx.details){
      const price=await repo.getPrice(client,d.prdid,input.pricecode);
      if(!price) fail(`Produk ${d.prdid} tidak memiliki pricecode ${input.pricecode}.`);
      d.pricecode=price.pricecode;
      d.dp=Number(price.dp||0); d.bv=Number(price.bv||0); d.pin=Number(price.pin||0);
      totalDp += d.qty*d.dp;
      totalBv += d.qty*d.bv;
      totalPin += d.qty*d.pin;
    }
  }
  return {totalDp,totalBv,totalPin};
}

function sameMoney(a,b){ return Math.round(Number(a)*100)===Math.round(Number(b)*100); }

async function create(body,actor){
  if(!actor?.username) fail('Session username tidak tersedia.',401);
  if(!actor?.stkid) fail('STKID user login tidak tersedia.',422);
  if(!actor?.pricecode) fail('Pricecode session tidak tersedia.',422);
  const input=normalizeBody(body,actor.pricecode);
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const totals=await hydrateTransactions(client,input);
    const totalTagihan=totals.totalDp+input.ongkir;
    const paytypes=input.payments.map(x=>x.paytype);
    const valid=await client.query(`SELECT paytype FROM public.payment WHERE paytype=ANY($1::varchar[])`,[paytypes]);
    if(valid.rowCount!==paytypes.length) fail('Salah satu paytype pembayaran tidak ditemukan.');
    const paid=input.payments.reduce((s,p)=>s+p.amount,0);
    if(!sameMoney(paid,totalTagihan)){
      fail(paid<totalTagihan?'Total pembayaran masih kurang.':'Total pembayaran melebihi total tagihan.');
    }
    const registerno=await repo.generateRegisterNo(client);
    const namakirim=input.kirim?input.transactions[0].nama:null;
    await repo.insertRegister(client,{
      registerno,kirim:input.kirim,alamat:input.alamat,kelurahan:input.kelurahan,kecamatan:input.kecamatan,
      wilayah:input.wilayah,kota:input.kota,kodepos:input.kodepos,bayar:totalTagihan,ongkir:input.ongkir,
      stkid:actor.stkid,username:actor.username,namakirim,tamount:totals.totalDp,tpin:totals.totalPin
    });
    for(const tx of input.transactions){
      const orderno=await repo.generateOrderNo(client);
      const transid=await repo.generateTransId(client);
      await repo.insertPinreg(client,{...tx,transid,orderno,registerno,stkid:actor.stkid,username:actor.username});
      for(const d of tx.details) await repo.insertDetail(client,{orderno,...d});
    }
    for(const p of input.payments) await repo.insertPayment(client,registerno,p);
    await client.query('COMMIT');
    return await getDetail(registerno,actor.stkid);
  }catch(e){ await client.query('ROLLBACK'); throw e; }
  finally{client.release();}
}

async function getDetail(registerno,stkid){
  const client=await db.pool.connect();
  try{return await repo.getRegister(client,registerno,stkid);}finally{client.release();}
}

async function list(opts){ return repo.listRegisters(opts); }
async function listProducts(search){ return repo.listProducts(search); }
async function prices(prdid,pricecode){ return repo.listPrices(prdid,pricecode); }
async function paymentTypes(){ return repo.listPaymentTypes(); }

async function assertEditable(client,registerno,stkid){
  const h=await client.query(`SELECT status_ambil FROM public.tr_kirim WHERE registerno=$1 AND stkid=$2 FOR UPDATE`,[registerno,stkid]);
  if(!h.rows[0]) fail('Register tidak ditemukan.',404);
  if(h.rows[0].status_ambil && h.rows[0].status_ambil!=='BELUM') fail(`Register ${registerno} sudah berstatus ${h.rows[0].status_ambil} dan tidak dapat diedit.`,409);
  const r=await client.query(`SELECT 1 FROM public.tr_register WHERE registerno=$1 LIMIT 1`,[registerno]);
  if(r.rows.length) fail(`Register ${registerno} sudah memiliki registrasi member dan tidak dapat diedit.`,409);
}

async function update(registerno,body,actor){
  if(!actor?.username||!actor?.stkid||!actor?.pricecode) fail('Session transaksi tidak lengkap.',401);
  const input=normalizeBody(body,actor.pricecode);
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    await assertEditable(client,registerno,actor.stkid);
    const old=await repo.getRegister(client,registerno,actor.stkid);
    const oldOrders=new Set(old.transactions.map(x=>x.orderno));
    const requestedOrders=input.transactions.map(x=>x.orderno).filter(Boolean);
    if(new Set(requestedOrders).size!==requestedOrders.length) fail('Order No transaksi PIN tidak boleh duplikat.');
    for(const orderno of requestedOrders){
      if(!oldOrders.has(orderno)) fail(`Transaksi ${orderno} bukan bagian dari Register ${registerno}.`,409);
    }
    const totals=await hydrateTransactions(client,input);
    const totalTagihan=totals.totalDp+input.ongkir;
    const paid=input.payments.reduce((s,p)=>s+p.amount,0);
    if(!sameMoney(paid,totalTagihan)) fail(paid<totalTagihan?'Total pembayaran masih kurang.':'Total pembayaran melebihi total tagihan.');
    const valid=await client.query(`SELECT paytype FROM public.payment WHERE paytype=ANY($1::varchar[])`,[input.payments.map(x=>x.paytype)]);
    if(valid.rowCount!==input.payments.length) fail('Salah satu paytype pembayaran tidak ditemukan.');

    await client.query(`
      UPDATE public.tr_kirim SET kirim=$2,alamat=$3,kelurahan=$4,kecamatan=$5,wilayah=$6,kota=$7,
      kodepos=$8,bayar=$9::numeric,ongkir=$10::numeric,updatedt=NOW(),updatenm=$11,
      namakirim=$12,tamount=$13::numeric,tpin=$14::integer
      WHERE registerno=$1 AND stkid=$15
    `,[registerno,input.kirim,input.alamat,input.kelurahan,input.kecamatan,input.wilayah,input.kota,input.kodepos,
       totalTagihan,input.ongkir,actor.username,input.kirim?input.transactions[0].nama:null,totals.totalDp,totals.totalPin,actor.stkid]);

    const oldMap=new Map(old.transactions.map(x=>[x.orderno,x]));
    const keep=new Set();
    for(const tx of input.transactions){
      let orderno=tx.orderno;
      if(orderno && !oldMap.has(orderno)) orderno=null;
      if(!orderno){ orderno=await repo.generateOrderNo(client); }
      keep.add(orderno);
      const oldTx=oldMap.get(orderno);
      if(oldTx){
        await client.query(`UPDATE public.tr_pinreg SET nama=$2,nohp=$3,usernamesp=$4,namasp=$5,updatedt=NOW(),updatenm=$6,stbayar=TRUE WHERE orderno=$1 AND stkid=$7`,
          [orderno,tx.nama,tx.nohp,tx.usernamesp,tx.namasp,actor.username,actor.stkid]);
        await client.query(`DELETE FROM public.tr_pinregdet WHERE orderno=$1`,[orderno]);
      }else{
        const transid=await repo.generateTransId(client);
        await repo.insertPinreg(client,{...tx,transid,orderno,registerno,stkid:actor.stkid,username:actor.username});
      }
      for(const d of tx.details) await repo.insertDetail(client,{orderno,...d});
    }
    const removed=[...oldMap.keys()].filter(o=>!keep.has(o));
    if(removed.length){
      await client.query(`DELETE FROM public.tr_pinregdet WHERE orderno=ANY($1::varchar[])`,[removed]);
      await client.query(`DELETE FROM public.tr_pinreg WHERE orderno=ANY($1::varchar[]) AND stkid=$2`,[removed,actor.stkid]);
    }
    await client.query(`DELETE FROM public.tr_bayar WHERE registerno=$1`,[registerno]);
    for(const p of input.payments) await repo.insertPayment(client,registerno,p);
    await client.query('COMMIT');
    return await getDetail(registerno,actor.stkid);
  }catch(e){await client.query('ROLLBACK');throw e;}
  finally{client.release();}
}

async function remove(registerno,stkid){
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    await assertEditable(client,registerno,stkid);
    await repo.deleteRegisterData(client,registerno,stkid);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}
  finally{client.release();}
}

module.exports={list,getDetail,listProducts,prices,paymentTypes,create,update,remove};
