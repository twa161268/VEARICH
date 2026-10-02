const $=id=>document.getElementById(id);
const S={transactions:[],payments:[],products:[],paymentTypes:[]};
const money=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const parseMoney=v=>{
 let s=String(v??'').replace(/[^0-9.,-]/g,'').trim();
 if(!s)return 0;
 const c=s.lastIndexOf(','),d=s.lastIndexOf('.');
 if(c>=0&&d>=0){
  s=c>d?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
 }else if(d>=0){
  const parts=s.split('.');
  s=parts.length>1&&parts.slice(1).every(x=>x.length===3)?parts.join(''):s;
 }else if(c>=0){
  const parts=s.split(',');
  s=parts.length>1&&parts.slice(1).every(x=>x.length===3)?parts.join(''):s.replace(',','.');
 }
 return Number(s)||0;
};
async function api(url,opt={}){const r=await fetch(url,{headers:{'Content-Type':'application/json'},...opt});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.msg||'Request gagal.');return j;}
function productOptions(sel){return '<option value="">Pilih produk...</option>'+S.products.map(p=>`<option value="${esc(p.prdid)}" ${p.prdid===sel?'selected':''}>${esc(p.prdid)} — ${esc(p.prdname||'')}</option>`).join('');}
function paymentOptions(sel){return '<option value="">Pilih type bayar...</option>'+S.paymentTypes.map(p=>`<option value="${esc(p.paytype)}" ${p.paytype===sel?'selected':''}>${esc(p.paytype)} — ${esc(p.deskripsi||'')}</option>`).join('');}
function addTx(tx={}){S.transactions.push({orderno:tx.orderno||'',nama:tx.nama||'',nohp:tx.nohp||'',usernamesp:tx.usernamesp||'',namasp:tx.namasp||'',details:(tx.details||[]).map(d=>({...d,qty:Number(d.qty||1),dp:Number(d.dp||0),bv:Number(d.bv||0),pin:Number(d.pin||0)}))});render();scrollLast();}
function addDetail(ti,d={}){S.transactions[ti].details.push({prdid:d.prdid||'',qty:Number(d.qty||1),dp:Number(d.dp||0),bv:Number(d.bv||0),pin:Number(d.pin||0)});render();}
function removeTx(i){if(!confirm('Hapus transaksi PIN ini dari Register?'))return;S.transactions.splice(i,1);render();}
function removeDetail(ti,di){S.transactions[ti].details.splice(di,1);render();}
function setTx(ti,key,val){S.transactions[ti][key]=val;}
function setQty(ti,di,val){S.transactions[ti].details[di].qty=Math.max(1,parseInt(val)||1);calc();}
async function pickProduct(ti,di,val){const d=S.transactions[ti].details[di];d.prdid=val;d.dp=d.bv=d.pin=0;if(val){try{const j=await api(`/transaksi/products/${encodeURIComponent(val)}/prices`);const p=j.data[0];if(!p)throw new Error(`Produk tidak memiliki pricecode ${window.TX_PRICECODE}.`);d.dp=Number(p.dp||0);d.bv=Number(p.bv||0);d.pin=Number(p.pin||0);}catch(e){alert(e.message);}}render();}
window.removeTx=removeTx;window.removeDetail=removeDetail;window.setQty=setQty;window.pickProduct=pickProduct;
function render(){
 $('txRows').innerHTML=S.transactions.length?S.transactions.map((t,ti)=>{
  let dp=0,bv=0,pin=0;t.details.forEach(d=>{dp+=d.qty*d.dp;bv+=d.qty*d.bv;pin+=d.qty*d.pin;});
  return `<div class="tx-block">
    <div class="tx-block-head"><div><span class="tx-number">TRANSAKSI PIN #${ti+1}</span><strong class="d-block">${esc(t.orderno||'ORDER NO OTOMATIS')}</strong></div><button type="button" class="btn btn-outline-danger btn-sm" onclick="removeTx(${ti})"><i class="bi bi-trash3 me-1"></i>Hapus Transaksi</button></div>
    <div class="row g-3 mb-2">
      <div class="col-md-6"><label class="form-label">Nama <span class="text-danger">*</span></label><input class="form-control" value="${esc(t.nama)}" oninput="setTx(${ti},'nama',this.value)"></div>
      <div class="col-md-6"><label class="form-label">No HP</label><input class="form-control" value="${esc(t.nohp)}" oninput="setTx(${ti},'nohp',this.value)"></div>
      <div class="col-md-6"><label class="form-label">Username Sponsor</label><input class="form-control" value="${esc(t.usernamesp)}" oninput="setTx(${ti},'usernamesp',this.value)"></div>
      <div class="col-md-6"><label class="form-label">Nama Sponsor</label><input class="form-control" value="${esc(t.namasp)}" oninput="setTx(${ti},'namasp',this.value)"></div>
    </div>
    <div class="d-flex justify-content-between align-items-center mb-2"><h6 class="fw-bold mb-0">Produk</h6><button type="button" class="btn btn-primary btn-sm" onclick="addDetail(${ti})"><i class="bi bi-plus-lg me-1"></i>Tambah Produk</button></div>
    <div>${t.details.length?t.details.map((d,di)=>`<div class="tx-detail row g-2 align-items-end">
      <div class="col-lg-3"><label class="form-label small">Produk</label><select class="form-select form-select-sm" onchange="pickProduct(${ti},${di},this.value)">${productOptions(d.prdid)}</select></div>
      <div class="col-lg-1"><label class="form-label small">Qty</label><input type="number" min="1" step="1" class="form-control form-control-sm" value="${d.qty}" oninput="setQty(${ti},${di},this.value)"></div>
      <div class="col-lg-2"><label class="form-label small">DP / Unit</label><input class="form-control form-control-sm readonly text-end" readonly value="${money(d.dp)}"></div>
      <div class="col-lg-2"><label class="form-label small">BV / Unit</label><input class="form-control form-control-sm readonly text-end" readonly value="${Number(d.bv||0).toLocaleString('id-ID')}"></div>
      <div class="col-lg-2"><label class="form-label small">PIN / Unit</label><input class="form-control form-control-sm readonly text-end" readonly value="${Number(d.pin||0).toLocaleString('id-ID')}"></div>
      <div class="col-lg-2"><button type="button" class="btn btn-outline-danger btn-sm w-100" onclick="removeDetail(${ti},${di})"><i class="bi bi-trash"></i></button></div>
    </div>`).join(''):'<div class="tx-empty">Belum ada produk. Klik Tambah Produk.</div>'}</div>
    <div class="tx-subtotal"><span>Subtotal transaksi</span><strong>${money(dp)}</strong><span>BV ${bv.toLocaleString('id-ID')}</span><span>PIN ${pin.toLocaleString('id-ID')}</span></div>
  </div>`;
 }).join(''):'<div class="tx-empty text-center py-5">Belum ada transaksi PIN. Klik Tambah Transaksi PIN.</div>';
 calc();
}
function renderPayments(){
 $('paymentEmpty').classList.toggle('d-none',S.payments.length>0);
 $('paymentRows').innerHTML=S.payments.map((p,i)=>`<div class="payment-row row g-2 align-items-end">
 <div class="col-md-2"><label class="form-label small">Paytype</label><select class="form-select form-select-sm" onchange="changePay(${i},this.value)">${paymentOptions(p.paytype)}</select></div>
 <div class="col-md-3"><label class="form-label small">Deskripsi</label><input class="form-control form-control-sm readonly" readonly value="${esc(p.deskripsi||'')}"></div>
 <div class="col-md-3"><label class="form-label small">Amount</label><input class="form-control form-control-sm text-end" inputmode="decimal" value="${esc(p.amount||'')}" oninput="changeAmt(${i},this.value)"></div>
 <div class="col-md-3"><label class="form-label small">Catatan</label><input maxlength="100" class="form-control form-control-sm" value="${esc(p.catatan||'')}" oninput="S.payments[${i}].catatan=this.value"></div>
 <div class="col-md-1"><button type="button" class="btn btn-outline-danger btn-sm w-100" onclick="removePay(${i})"><i class="bi bi-trash"></i></button></div>
 </div>`).join('');
}
function changePay(i,v){const p=S.paymentTypes.find(x=>x.paytype===v);S.payments[i].paytype=v;S.payments[i].deskripsi=p?.deskripsi||'';renderPayments();calc();}
function changeAmt(i,v){S.payments[i].amount=v.replace(/[^0-9.,]/g,'');calc();}
function removePay(i){S.payments.splice(i,1);renderPayments();calc();}
window.changePay=changePay;window.changeAmt=changeAmt;window.removePay=removePay;
function calc(){
 let dp=0,bv=0,pin=0;S.transactions.forEach(t=>t.details.forEach(d=>{dp+=d.qty*d.dp;bv+=d.qty*d.bv;pin+=d.qty*d.pin;}));
 const ong=parseMoney($('ongkir').value),total=dp+ong,paid=S.payments.reduce((s,p)=>s+parseMoney(p.amount),0);
 $('totalDp').textContent=money(dp);$('totalBv').textContent=bv.toLocaleString('id-ID');$('totalPin').textContent=pin.toLocaleString('id-ID');$('totalOngkir').textContent=money(ong);$('grandTotal').textContent=money(total);$('totalPayment').textContent=money(paid);
 const box=$('paymentStatus');
 if(!S.transactions.length){box.className='alert alert-secondary';box.textContent='Tambahkan minimal satu transaksi PIN.';}
 else if(Math.abs(paid-total)<.01&&total>0){box.className='alert alert-success';box.textContent='LUNAS — total pembayaran sesuai tagihan.';}
 else if(paid<total){box.className='alert alert-warning';box.textContent=`KURANG BAYAR — ${money(total-paid)}`;}
 else if(paid>total){box.className='alert alert-danger';box.textContent=`LEBIH BAYAR — ${money(paid-total)}`;}
 else {box.className='alert alert-secondary';box.textContent='Masukkan pembayaran.';}
}
$('btnAddTx').onclick=()=>addTx();
$('btnAddPayment').onclick=()=>{S.payments.push({paytype:'',deskripsi:'',amount:'',catatan:''});renderPayments();};
$('ongkir').addEventListener('input',calc);$('kirim').addEventListener('change',calc);
function scrollLast(){setTimeout(()=>{const els=document.querySelectorAll('.tx-block');els[els.length-1]?.scrollIntoView({behavior:'smooth',block:'center'});},50);}
async function loadEdit(){
 const j=await api(`/transaksi/detail/${encodeURIComponent(window.TX_REGISTER)}`);const d=j.data;if($('stkid'))$('stkid').value=d.header.stkid||$('stkid').value||'';
 $('kirim').value=String(!!d.header.kirim);$('ongkir').value=Number(d.header.ongkir||0).toLocaleString('id-ID');['alamat','kelurahan','kecamatan','wilayah','kota','kodepos'].forEach(k=>$(k).value=d.header[k]||'');
 const map={};
 d.transactions.forEach(t=>map[t.orderno]={...t,details:[]});
 d.details.forEach(x=>map[x.orderno]?.details.push(x));
 S.transactions=Object.values(map);
 S.payments=d.payments.map(p=>({...p,amount:Number(p.amount||0).toLocaleString('id-ID')}));
 render();renderPayments();calc();
}
async function init(){
 try{
  const [p,pt]=await Promise.all([api('/transaksi/products'),api('/transaksi/payment')]);
  S.products=p.data;S.paymentTypes=pt.data;
  if(window.TX_EDIT) await loadEdit(); else {addTx();addDetail(0);renderPayments();}
 }catch(e){alert(e.message);}
}
$('txForm').addEventListener('submit',async e=>{
 e.preventDefault();
 try{
  const body={stkid:$('stkid')?.value||'',kirim:$('kirim').value,ongkir:$('ongkir').value,alamat:$('alamat').value,kelurahan:$('kelurahan').value,kecamatan:$('kecamatan').value,wilayah:$('wilayah').value,kota:$('kota').value,kodepos:$('kodepos').value,
   transactions:S.transactions.map(t=>({orderno:t.orderno,nama:t.nama,nohp:t.nohp,usernamesp:t.usernamesp,namasp:t.namasp,details:t.details.map(d=>({prdid:d.prdid,qty:d.qty}))})),
   payments:S.payments.map(p=>({paytype:p.paytype,amount:p.amount,catatan:p.catatan}))};
  if(!body.stkid)throw new Error('Stockist wajib dipilih.');
  if(!S.transactions.length)throw new Error('Minimal satu transaksi PIN.');
  if(S.transactions.some(t=>!t.nama.trim()))throw new Error('Nama wajib diisi pada setiap transaksi PIN.');
  if(S.transactions.some(t=>!t.details.length))throw new Error('Setiap transaksi PIN harus memiliki minimal satu produk.');
  if(!S.payments.length)throw new Error('Minimal satu pembayaran.');
  const url=window.TX_EDIT?`/transaksi/update/${encodeURIComponent(window.TX_REGISTER)}`:'/transaksi/create';
  const j=await api(url,{method:'POST',body:JSON.stringify(body)});
  alert(j.msg||'Transaksi berhasil disimpan.');location.href='/transaksi';
 }catch(e){alert(e.message);}
});
init();
