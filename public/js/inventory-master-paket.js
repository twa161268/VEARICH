const modal = new bootstrap.Modal(document.getElementById('packModal'));
const packList = document.getElementById('packList');
const prdidcatEl = document.getElementById('prdidcat');
const pricecodeEl = document.getElementById('pricecode');
const componentRows = document.getElementById('componentRows');
let packs=[], options={packages:[],components:[]}, editKey=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function keyOf(a,b){return `${encodeURIComponent(a)}|${encodeURIComponent(b)}`;}
async function api(url,opt={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});const j=await r.json().catch(()=>({}));if(!r.ok||j.success===false)throw new Error(j.msg||'Request gagal');return j;}
function showError(msg){document.getElementById('alertBox').innerHTML=`<div class="alert alert-danger alert-dismissible fade show">${esc(msg)}<button class="btn-close" data-bs-dismiss="alert"></button></div>`;}
function render(){
  const groups=new Map();
  for(const r of packs){const k=keyOf(r.prdidcat,r.pricecode);if(!groups.has(k))groups.set(k,{prdidcat:r.prdidcat,prdidcatnm:r.prdidcatnm,pricecode:r.pricecode,components:[]});groups.get(k).components.push(r);}
  const arr=[...groups.values()];
  packList.innerHTML=arr.map(g=>`<div class="col-md-6 col-xl-4"><div class="card border-0 shadow-sm h-100"><div class="card-body">
    <div class="d-flex justify-content-between gap-2"><div><div class="eyebrow">PAKET</div><h5 class="fw-bold mb-1">${esc(g.prdidcatnm||g.prdidcat)}</h5><div class="text-secondary small">Kode: ${esc(g.prdidcat)} • Pricecode: <strong>${esc(g.pricecode)}</strong></div></div><div class="dropdown"><button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown">⋮</button><ul class="dropdown-menu dropdown-menu-end"><li><button class="dropdown-item edit" data-prdidcat="${esc(g.prdidcat)}" data-pricecode="${esc(g.pricecode)}">Edit</button></li><li><button class="dropdown-item text-danger del" data-prdidcat="${esc(g.prdidcat)}" data-pricecode="${esc(g.pricecode)}">Hapus</button></li></ul></div></div>
    <div class="table-responsive mt-3"><table class="table table-sm mb-0"><thead><tr><th>Komponen</th><th class="text-end">Qty</th></tr></thead><tbody>${g.components.map(c=>`<tr><td>${esc(c.prdname||c.prdid)}<div class="small text-secondary">${esc(c.prdid)}</div></td><td class="text-end fw-bold">${Number(c.qty).toLocaleString('id-ID')}</td></tr>`).join('')}</tbody></table></div>
  </div></div></div>`).join('') || '<div class="col-12"><div class="text-center text-secondary py-5">Belum ada Master Paket.</div></div>';
  document.querySelectorAll('.edit').forEach(b=>b.onclick=()=>openEdit(b.dataset.prdidcat,b.dataset.pricecode));
  document.querySelectorAll('.del').forEach(b=>b.onclick=()=>removePack(b.dataset.prdidcat,b.dataset.pricecode));
}
function packageOptions(selected=''){
  prdidcatEl.innerHTML='<option value="">-- pilih produk paket --</option>'+options.packages.map(p=>`<option value="${esc(p.prdid)}" ${p.prdid===selected?'selected':''}>${esc(p.prdid)} - ${esc(p.prdname)}</option>`).join('');
}
function priceOptions(selected=''){
  const pkg=options.packages.find(x=>x.prdid===prdidcatEl.value);
  const pcs=pkg?.pricecodes||[];
  pricecodeEl.innerHTML='<option value="">-- pilih pricecode --</option>'+pcs.map(pc=>`<option value="${esc(pc)}" ${String(pc)===String(selected)?'selected':''}>${esc(pc)}</option>`).join('');
}
function componentChoices(selected=''){
  const pc=pricecodeEl.value;
  const rows=options.components.filter(x=>String(x.pricecode)===String(pc));
  return '<option value="">-- pilih produk --</option>'+rows.map(x=>`<option value="${esc(x.prdid)}" ${x.prdid===selected?'selected':''}>${esc(x.prdid)} - ${esc(x.prdname)}</option>`).join('');
}
function addRow(item={}){
  const tr=document.createElement('tr');
  tr.innerHTML=`<td><select class="form-select component">${componentChoices(item.prdid||'')}</select></td><td><span class="price-label">${esc(pricecodeEl.value||'-')}</span></td><td><input class="form-control qty" type="number" min="1" step="1" value="${item.qty??1}"></td><td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger remove">×</button></td>`;
  tr.querySelector('.remove').onclick=()=>tr.remove();
  componentRows.appendChild(tr);
}
function refreshRowsChoices(){document.querySelectorAll('.component').forEach(sel=>{const old=sel.value;sel.innerHTML=componentChoices(old);if([...sel.options].some(o=>o.value===old))sel.value=old;});document.querySelectorAll('.price-label').forEach(x=>x.textContent=pricecodeEl.value||'-');}
function resetForm(){editKey=null;document.getElementById('modalTitle').textContent='Tambah Master Paket';packageOptions();pricecodeEl.innerHTML='<option value="">-- pilih pricecode --</option>';componentRows.innerHTML='';}
async function openEdit(prdidcat,pricecode){
  try{const j=await api(`/inventory/api/master-paket/${encodeURIComponent(prdidcat)}/${encodeURIComponent(pricecode)}`);const d=j.data;editKey={prdidcat,pricecode};document.getElementById('modalTitle').textContent='Edit Master Paket';packageOptions(prdidcat);priceOptions(pricecode);componentRows.innerHTML='';(d.components||[]).forEach(addRow);modal.show();}catch(e){showError(e.message);}
}
prdidcatEl.onchange=()=>{priceOptions();componentRows.innerHTML='';};
pricecodeEl.onchange=()=>{componentRows.innerHTML='';};
document.getElementById('addComponent').onclick=()=>{if(!pricecodeEl.value)return showError('Pilih Produk Paket dan Pricecode terlebih dahulu.');addRow();};
document.getElementById('addPack').onclick=()=>{resetForm();modal.show();};
document.getElementById('savePack').onclick=async()=>{
  try{
    const prdidcat=prdidcatEl.value, pricecode=pricecodeEl.value;
    if(!prdidcat)throw new Error('Produk Paket wajib dipilih.');
    if(!pricecode)throw new Error('Pricecode wajib dipilih.');
    const components=[...document.querySelectorAll('#componentRows tr')].map(tr=>({prdid:tr.querySelector('.component').value,pricecode,qty:tr.querySelector('.qty').value}));
    if(!components.length)throw new Error('Minimal satu komponen paket harus diisi.');
    const url=editKey?`/inventory/api/master-paket/${encodeURIComponent(editKey.prdidcat)}/${encodeURIComponent(editKey.pricecode)}`:'/inventory/api/master-paket';
    await api(url,{method:editKey?'PUT':'POST',body:JSON.stringify({prdidcat,pricecode,components})});
    modal.hide();await load();
  }catch(e){showError(e.message);}
};
async function removePack(prdidcat,pricecode){
  if(!confirm(`Hapus komposisi ${prdidcat} / pricecode ${pricecode}?`))return;
  try{await api(`/inventory/api/master-paket/${encodeURIComponent(prdidcat)}/${encodeURIComponent(pricecode)}`,{method:'DELETE'});await load();}catch(e){showError(e.message);}
}
async function load(){try{const [a,b]=await Promise.all([api('/inventory/api/master-paket'),api('/inventory/api/master-paket/options')]);packs=a.data||[];options=b;render();}catch(e){showError(e.message);}}
load();
