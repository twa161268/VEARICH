const type=window.INV_TX_TYPE;
const modal=new bootstrap.Modal(document.getElementById('modal'));
let page=1, editingId=null, products=[], batches=[], suppliers=[], warehouses=[];
const idFields={masuk:'masuk_id',keluar:'keluar_id',retur_beli:'retur_beli_id',retur_jual:'retur_jual_id',transfer:'transfer_id',adjustment:'adjustment_id',opname:'opname_id'};
const noFields={masuk:'no_masuk',keluar:'no_keluar',retur_beli:'no_retur',retur_jual:'no_retur',transfer:'no_transfer',adjustment:'no_adjustment',opname:'no_opname'};
const cfg={
 masuk:{name:'Barang Masuk',heads:['Produk','Batch','Qty','Harga','Subtotal',''], fields:['product','batch','qty','harga']},
 keluar:{name:'Barang Keluar',heads:['Produk','Batch','Qty',''],fields:['product','batch','qty']},
 retur_beli:{name:'Retur Pembelian',heads:['Produk','Batch','Qty',''],fields:['product','batch','qty']},
 retur_jual:{name:'Retur Penjualan',heads:['Produk','Batch','Qty',''],fields:['product','batch','qty']},
 transfer:{name:'Transfer Gudang',heads:['Produk','Batch','Qty',''],fields:['product','batch','qty']},
 adjustment:{name:'Adjustment Stock',heads:['Produk','Batch','Tipe','Qty',''],fields:['product','batch','tipe','qty']},
 opname:{name:'Stock Opname',heads:['Produk','Batch','Stok Sistem','Stok Fisik','Selisih',''],fields:['product','batch','stok_sistem','stok_fisik']}
}[type];

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
function dateLocal(v){const d=v?new Date(v):new Date();const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
async function api(url,opt={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});const j=await r.json().catch(()=>({success:false,msg:'Response tidak valid'}));if(!r.ok||j.success===false)throw new Error(j.msg||'Request gagal');return j;}
function stockistOptions(selected=''){
 const list=Array.isArray(window.INV_STOCKISTS)?window.INV_STOCKISTS:[];
 return '<option value="">- pilih stockist -</option>'+list.map(x=>`<option value="${esc(x.stkid)}" ${String(selected)===String(x.stkid)?'selected':''}>${esc(x.stkid)} - ${esc(x.namastk||'')}</option>`).join('');
}
function renderDestinationStockists(selected=''){
 if(type!=='transfer'||!window.INV_IS_ADMIN)return;
 const el=$('dest_stkid'); if(!el)return;
 el.innerHTML=stockistOptions(selected);
}
async function loadDestinationWarehouses(stkid, selectedId=''){
 const qs=stkid?`?stkid=${encodeURIComponent(stkid)}`:'';
 const w=await api('/inventory/api/warehouses'+qs);
 warehouses=w.data||[];
 const ws=$('gudang_tujuan_id');
 if(!ws)return;
 ws.innerHTML='<option value="">- pilih -</option>'+warehouses.map(x=>`<option value="${x.gudang_id}" ${String(selectedId)===String(x.gudang_id)?'selected':''}>${esc(x.kode)} - ${esc(x.nama)}</option>`).join('');
}
async function loadRefs(){
 const stockistEl=$('stkid');
 const sourceStkid=window.INV_IS_ADMIN ? (stockistEl?.value || window.INV_SELECTED_STKID || '') : (window.INV_SESSION_STKID || '');
 const [p,b,s]=await Promise.all([
  api('/inventory/api/products?limit=100'), api('/inventory/api/master/batch'), api('/inventory/api/master/supplier')
 ]);
 products=p.rows;batches=b.data.filter(x=>x.aktif);suppliers=s.data.filter(x=>x.aktif);
 const sel=$('supplier_id');if(sel)sel.innerHTML='<option value="">- pilih -</option>'+suppliers.map(x=>`<option value="${x.supplier_id}">${esc(x.kode)} - ${esc(x.nama)}</option>`).join('');
 if(type==='transfer'){
   const destStk=$('dest_stkid');
   if(window.INV_IS_ADMIN){
     renderDestinationStockists(sourceStkid);
     await loadDestinationWarehouses(destStk?.value||sourceStkid);
     if(stockistEl)stockistEl.addEventListener('change',async()=>{
       const source=stockistEl.value||'';
       renderDestinationStockists(source);
       await loadDestinationWarehouses(source);
     });
     if(destStk)destStk.addEventListener('change',async()=>loadDestinationWarehouses(destStk.value||''));
   }else{
     await loadDestinationWarehouses(sourceStkid);
   }
 }else{
   const w=await api('/inventory/api/warehouses'+(sourceStkid?`?stkid=${encodeURIComponent(sourceStkid)}`:''));
   warehouses=w.data||[];
 }
}
async function reloadWarehouses(){
 const stkid=type==='transfer'&&window.INV_IS_ADMIN ? ($('dest_stkid')?.value||'') : ($('stkid')?.value||'');
 await loadDestinationWarehouses(stkid);
}
function productOptions(selected=''){return '<option value="">- pilih produk -</option>'+products.filter(p=>p.stock_managed).map(p=>`<option value="${esc(p.prdid)}" ${String(selected)===String(p.prdid)?'selected':''}>${esc(p.prdid)} - ${esc(p.prdname)}</option>`).join('');}
function batchOptions(prdid,selected=''){return '<option value="">- tanpa batch -</option>'+batches.filter(b=>String(b.prdid)===String(prdid)).map(b=>`<option value="${b.batch_id}" ${String(selected)===String(b.batch_id)?'selected':''}>${esc(b.batch_no)}${b.tanggal_expired?' | exp '+esc(b.tanggal_expired):''}</option>`).join('');}
function line(d={}){
 const tr=document.createElement('tr'); tr.dataset.old=JSON.stringify(d);
 let h='';
 h+=`<td><select class="form-select form-select-sm product">${productOptions(d.prdid)}</select></td>`;
 h+=`<td><select class="form-select form-select-sm batch">${batchOptions(d.prdid,d.batch_id)}</select></td>`;
 if(type==='adjustment')h+=`<td><select class="form-select form-select-sm tipe"><option value="IN" ${d.tipe==='IN'?'selected':''}>IN</option><option value="OUT" ${d.tipe==='OUT'?'selected':''}>OUT</option></select></td>`;
 if(type==='opname')h+=`<td><input class="form-control form-control-sm stok_sistem" readonly value="${d.stok_sistem??''}"></td><td><input type="number" min="0" step="0.001" class="form-control form-control-sm stok_fisik" value="${d.stok_fisik??0}"></td><td><input class="form-control form-control-sm selisih" readonly value="${d.selisih??0}"></td>`;
 else {h+=`<td><input type="number" min="0.001" step="0.001" class="form-control form-control-sm qty" value="${d.qty??1}"></td>`;if(type==='masuk')h+=`<td><input type="number" min="0" step="0.01" class="form-control form-control-sm harga" value="${d.harga??0}"></td><td><input class="form-control form-control-sm subtotal" readonly value="${d.subtotal??0}"></td>`;}
 h+=`<td><button type="button" class="btn btn-sm btn-outline-danger del">×</button></td>`;tr.innerHTML=h;$('details').appendChild(tr);
 tr.querySelector('.product').addEventListener('change',e=>{tr.querySelector('.batch').innerHTML=batchOptions(e.target.value);});
 tr.querySelector('.del').onclick=()=>tr.remove();
 if(type==='masuk')tr.querySelector('.qty').addEventListener('input',()=>calc(tr));
 if(type==='masuk')tr.querySelector('.harga').addEventListener('input',()=>calc(tr));
 if(type==='opname')tr.querySelector('.stok_fisik').addEventListener('input',()=>calcOp(tr));
 return tr;
}
function calc(tr){tr.querySelector('.subtotal').value=(Number(tr.querySelector('.qty').value||0)*Number(tr.querySelector('.harga').value||0)).toFixed(2);}
function calcOp(tr){tr.querySelector('.selisih').value=(Number(tr.querySelector('.stok_fisik').value||0)-Number(tr.querySelector('.stok_sistem').value||0)).toFixed(3);}
function collect(){
 const details=[...document.querySelectorAll('#details tr')].map(tr=>{
  const d={prdid:tr.querySelector('.product').value,batch_id:tr.querySelector('.batch').value||null};
  if(type==='adjustment'){d.tipe=tr.querySelector('.tipe').value;d.qty=tr.querySelector('.qty').value;}
  else if(type==='opname'){d.stok_sistem=tr.querySelector('.stok_sistem').value;d.stok_fisik=tr.querySelector('.stok_fisik').value;d.selisih=tr.querySelector('.selisih').value;}
  else {d.qty=tr.querySelector('.qty').value;if(type==='masuk'){d.harga=tr.querySelector('.harga').value;d.subtotal=tr.querySelector('.subtotal').value;}}
  return d;
 });
 return {
  stkid:$('stkid')?.value||null,
  dest_stkid:type==='transfer'&&window.INV_IS_ADMIN?($('dest_stkid')?.value||null):null,
  tanggal:$('tanggal').value,
  supplier_id:$('supplier_id').value||null,
  gudang_tujuan_id:$('gudang_tujuan_id').value||null,
  orderno:$('orderno').value.trim()||null,
  keterangan:$('keterangan').value.trim()||null,
  details
 };
}
async function resetForm(){
 editingId=null;$('save').disabled=false;$('id').value='';$('tanggal').value=dateLocal();
 if($('stkid') && window.INV_IS_ADMIN){$('stkid').disabled=false;$('stkid').value=window.INV_SELECTED_STKID||'';}
 if(type==='transfer'&&window.INV_IS_ADMIN){renderDestinationStockists($('stkid')?.value||'');await loadDestinationWarehouses($('dest_stkid')?.value||$('stkid')?.value||'');}
 $('supplier_id').value='';$('gudang_tujuan_id').value='';$('orderno').value='';$('keterangan').value='';$('details').innerHTML='';line();document.querySelectorAll('#form input,#form select,#addLine').forEach(x=>x.disabled=false);$('msg').textContent='';$('modalTitle').textContent='Tambah '+cfg.name;
}
function setupFields(){
 $('supplierWrap').style.display=['masuk','retur_beli'].includes(type)?'block':'none';
 $('destWrap').style.display=type==='transfer'?'block':'none';
 $('destStockistWrap').style.display=type==='transfer'&&window.INV_IS_ADMIN?'block':'none';
 $('orderWrap').style.display=type==='retur_jual'?'block':'none';
 $('dhead').innerHTML='<tr>'+cfg.heads.map(x=>`<th>${x}</th>`).join('')+'</tr>';
}
async function loadList(){
 const j=await api(`/inventory/api/transaksi/${type}?page=${page}&limit=20&search=${encodeURIComponent($('search').value)}`);
 $('rows').innerHTML=j.rows.length?j.rows.map(r=>{const id=r[idFields[type]],no=r[noFields[type]];const info=type==='transfer'?(r.dest_gudang_nama?`${esc(r.dest_namastk||r.dest_stkid||'')} / ${esc(r.dest_gudang_kode||'')} - ${esc(r.dest_gudang_nama)}`:`Tujuan #${esc(r.gudang_tujuan_id)}`):esc(r.keterangan||'');return `<tr><td><a href="#" class="open" data-id="${id}">${esc(no)}</a></td><td>${esc(r.tanggal)}</td><td><span class="badge status-${String(r.status).toLowerCase()}">${esc(r.status)}</span></td><td>${info}</td><td class="text-end">${r.status==='DRAFT'?`<button class="btn btn-sm btn-outline-primary edit" data-id="${id}">Edit</button> <button class="btn btn-sm btn-outline-success final" data-id="${id}">Final</button> <button class="btn btn-sm btn-outline-danger deldoc" data-id="${id}">Hapus</button>`:''}</td></tr>`}).join(''):'<tr><td colspan="5" class="text-center text-secondary py-4">Belum ada data.</td></tr>';
 $('info').textContent=`Halaman ${j.page} / ${j.pages} • ${j.total} data`;$('prev').disabled=j.page<=1;$('next').disabled=j.page>=j.pages;
 document.querySelectorAll('.open').forEach(a=>a.onclick=async e=>{e.preventDefault();openEdit(a.dataset.id)});
 document.querySelectorAll('.edit').forEach(b=>b.onclick=()=>openEdit(b.dataset.id));
 document.querySelectorAll('.final').forEach(b=>b.onclick=()=>finalDoc(b.dataset.id));
 document.querySelectorAll('.deldoc').forEach(b=>b.onclick=()=>deleteDoc(b.dataset.id));
}
async function openEdit(id){
 const j=await api(`/inventory/api/transaksi/${type}/${id}`);editingId=id;const h=j.header;$('id').value=id;
 if($('stkid')){$('stkid').value=h.stkid||'';$('stkid').disabled=true;}
 $('tanggal').value=dateLocal(h.tanggal);$('supplier_id').value=h.supplier_id||'';
 if(type==='transfer'&&window.INV_IS_ADMIN){renderDestinationStockists(h.dest_stkid||h.stkid||'');await loadDestinationWarehouses(h.dest_stkid||h.stkid||'',h.gudang_tujuan_id||'');}
 else if(type==='transfer'){await loadDestinationWarehouses(h.stkid||window.INV_SESSION_STKID||'',h.gudang_tujuan_id||'');}
 $('gudang_tujuan_id').value=h.gudang_tujuan_id||'';$('orderno').value=h.orderno||'';$('keterangan').value=h.keterangan||'';$('details').innerHTML='';j.details.forEach(d=>line(d));
 $('modalTitle').textContent=`Edit ${cfg.name} — ${h[noFields[type]]}`;$('msg').textContent=h.status==='DRAFT'?'':'Transaksi '+h.status+' hanya dapat dilihat.';$('save').disabled=h.status!=='DRAFT';
 document.querySelectorAll('#form input,#form select,#addLine').forEach(x=>x.disabled=h.status!=='DRAFT');
 // Source stockist remains fixed during edit; ADMIN may still change Stockist Tujuan.
 if(type==='transfer'&&window.INV_IS_ADMIN&&h.status==='DRAFT'){$('dest_stkid').disabled=false;$('gudang_tujuan_id').disabled=false;}
 modal.show();
}
async function finalDoc(id){if(!confirm('FINAL-kan transaksi? Setelah FINAL transaksi tidak dapat diedit/dihapus dan stok akan berubah.'))return;try{await api(`/inventory/api/transaksi/${type}/${id}/final`,{method:'POST',body:'{}'});alert('Transaksi berhasil FINAL.');loadList();}catch(e){alert(e.message)}}
async function deleteDoc(id){if(!confirm('Hapus transaksi DRAFT ini?'))return;try{await api(`/inventory/api/transaksi/${type}/${id}`,{method:'DELETE'});loadList();}catch(e){alert(e.message)}}
$('add').onclick=async()=>{await resetForm();modal.show();};
$('addLine').onclick=()=>line();
$('save').onclick=async()=>{try{const body=collect();if(!body.stkid)throw new Error('Stockist wajib dipilih.');if(type==='transfer'&&!body.gudang_tujuan_id)throw new Error('Gudang tujuan wajib dipilih.');if(!body.details.every(d=>d.prdid))throw new Error('Semua detail harus memilih produk.');const url=editingId?`/inventory/api/transaksi/${type}/${editingId}`:`/inventory/api/transaksi/${type}`;const j=await api(url,{method:editingId?'PUT':'POST',body:JSON.stringify(body)});modal.hide();loadList();alert(editingId?'Transaksi diperbarui.':'DRAFT berhasil disimpan.');}catch(e){$('msg').textContent=e.message;}};
$('prev').onclick=()=>{if(page>1){page--;loadList();}};$('next').onclick=()=>{page++;loadList();};$('refresh').onclick=()=>{page=1;loadList();};$('search').addEventListener('keydown',e=>{if(e.key==='Enter'){page=1;loadList();}});
setupFields();loadRefs().then(loadList).catch(e=>alert(e.message));
