let page = 1;
let formDataCache = null;
let productModal = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('id-ID', {maximumFractionDigits: 2});

async function api(url, options={}) {
  const r = await fetch(url, {headers:{'Content-Type':'application/json', ...(options.headers||{})}, ...options});
  const j = await r.json().catch(()=>({success:false,msg:'Response server tidak valid.'}));
  if (!r.ok || !j.success) throw new Error(j.msg || 'Request gagal.');
  return j;
}

async function loadProducts() {
  const searchEl=document.getElementById('search');
  if(!searchEl) return;
  const q=searchEl.value.trim();
  const j=await api(`/inventory/api/products?page=${page}&limit=20&search=${encodeURIComponent(q)}`);
  document.getElementById('rows').innerHTML=j.rows.map(x=>`
    <tr>
      <td><strong>${esc(x.prdid)}</strong></td>
      <td><div>${esc(x.prdname)}</div><small class="text-secondary">${esc(x.kategori_nama||'-')}</small></td>
      <td>${esc(x.barcode||'-')}</td>
      <td>${esc(x.satuan_nama||'-')}</td>
      <td class="text-end">${esc(x.stok_minimum)}</td>
      <td>${x.stock_managed?'<span class="badge text-bg-success">YA</span>':'<span class="badge text-bg-secondary">TIDAK</span>'}</td>
      <td>${x.status?'<span class="badge text-bg-success">Aktif</span>':'<span class="badge text-bg-secondary">Nonaktif</span>'}</td>
      <td class="text-center">${x.pricecode_count||0}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary" onclick="editProduct('${encodeURIComponent(x.prdid)}')">Edit</button>
        ${x.status?`<button class="btn btn-sm btn-outline-danger" onclick="deactivateProduct('${encodeURIComponent(x.prdid)}')">Nonaktif</button>`:''}
      </td>
    </tr>`).join('') || '<tr><td colspan="9" class="text-center py-4">Tidak ada data.</td></tr>';
  document.getElementById('info').textContent=`Halaman ${j.page}/${j.pages} • ${j.total} produk`;
  document.getElementById('prev').disabled=j.page<=1;
  document.getElementById('next').disabled=j.page>=j.pages;
}

async function loadProductFormData(){
  if(formDataCache) return formDataCache;
  formDataCache=await api('/inventory/api/products/form-data');
  const k=document.getElementById('kode'), s=document.getElementById('satuan_id');
  if(k) k.innerHTML='<option value="">-- pilih kategori --</option>'+formDataCache.kategori.map(x=>`<option value="${esc(x.kode)}">${esc(x.nama)} (${esc(x.kode)})</option>`).join('');
  if(s) s.innerHTML='<option value="">-- pilih satuan --</option>'+formDataCache.satuan.map(x=>`<option value="${x.satuan_id}">${esc(x.nama)} (${esc(x.kode)})</option>`).join('');
  return formDataCache;
}

function clearProductError(){const e=document.getElementById('productError');if(e){e.textContent='';e.classList.add('d-none');}}
function showProductError(msg){const e=document.getElementById('productError');if(e){e.textContent=msg;e.classList.remove('d-none');}}
function priceRow(data={}){
  const tr=document.createElement('tr');
  tr.className='price-row';
  const locked=!!data.used_in_transaction;
  tr.innerHTML=`
    <td>
      <input class="form-control form-control-sm pricecode" maxlength="4" value="${esc(data.pricecode||'')}" ${locked?'readonly':''}>
      ${locked?'<small class="text-danger">Sudah dipakai transaksi</small>':''}
    </td>
    <td><input class="form-control form-control-sm dp" type="number" min="0" step="0.01" value="${data.dp??''}" ${locked?'readonly':''}></td>
    <td><input class="form-control form-control-sm bv" type="number" min="0" step="0.01" value="${data.bv??''}" ${locked?'readonly':''}></td>
    <td><input class="form-control form-control-sm pin" type="number" min="0" step="0.01" value="${data.pin??''}" ${locked?'readonly':''}></td>
    <td>${locked
      ? '<span class="text-secondary small" title="Pricecode yang sudah dipakai transaksi tidak dapat dihapus">🔒</span>'
      : '<button type="button" class="btn btn-sm btn-outline-danger remove-price" title="Hapus">×</button>'}</td>`;
  const remove=tr.querySelector('.remove-price');
  if(remove) remove.onclick=()=>{tr.remove();syncPriceEmpty();};
  document.getElementById('priceRows').appendChild(tr);
  syncPriceEmpty();
}
function syncPriceEmpty(){const rows=document.querySelectorAll('#priceRows .price-row');const e=document.getElementById('priceEmpty');if(e)e.classList.toggle('d-none',rows.length>0);}
function resetProductForm(){
  document.getElementById('productForm').reset();
  document.getElementById('productMode').value='create';
  document.getElementById('productModalTitle').textContent='Tambah Produk';
  document.getElementById('prdid').disabled=false;
  document.getElementById('status').checked=true;
  document.getElementById('stock_managed').checked=true;
  document.getElementById('stok_minimum').value='0';
  document.getElementById('priceRows').innerHTML=''; syncPriceEmpty(); clearProductError();
}
async function openProductModal(prdid=null){
  try{
    await loadProductFormData();
    resetProductForm();
    if(prdid){
      const j=await api(`/inventory/api/products/${encodeURIComponent(prdid)}`);
      const p=j.product;
      document.getElementById('productMode').value='edit';
      document.getElementById('productModalTitle').textContent='Edit Produk';
      document.getElementById('prdid').value=p.prdid;
      document.getElementById('prdid').disabled=true;
      document.getElementById('prdname').value=p.prdname||'';
      document.getElementById('kode').value=p.kode||'';
      document.getElementById('barcode').value=p.barcode||'';
      document.getElementById('satuan_id').value=p.satuan_id||'';
      document.getElementById('stok_minimum').value=p.stok_minimum??0;
      document.getElementById('status').checked=!!p.status;
      document.getElementById('stock_managed').checked=!!p.stock_managed;
      (j.prices||[]).forEach(priceRow);
    }
    if(window.bootstrap && document.getElementById('productModal')){
      productModal=productModal||new bootstrap.Modal(document.getElementById('productModal'));
      productModal.show();
    }
  }catch(e){alert(e.message);}
}
async function editProduct(prdid){openProductModal(decodeURIComponent(prdid));}
async function deactivateProduct(prdid){
  prdid=decodeURIComponent(prdid);
  if(!confirm(`Nonaktifkan produk ${prdid}?`)) return;
  try{const j=await api(`/inventory/api/products/${encodeURIComponent(prdid)}/deactivate`,{method:'POST',body:JSON.stringify({})});alert(j.data?.reason||'Produk berhasil dinonaktifkan.');loadProducts();}
  catch(e){alert(e.message);}
}
async function saveProduct(e){
  e.preventDefault(); clearProductError();
  const mode=document.getElementById('productMode').value;
  const prices=[...document.querySelectorAll('#priceRows .price-row')].map(r=>({pricecode:r.querySelector('.pricecode').value.trim(),dp:r.querySelector('.dp').value,bv:r.querySelector('.bv').value,pin:r.querySelector('.pin').value}));
  const body={
    prdid:document.getElementById('prdid').value.trim(),
    prdname:document.getElementById('prdname').value.trim(),
    kode:document.getElementById('kode').value,
    barcode:document.getElementById('barcode').value.trim(),
    satuan_id:document.getElementById('satuan_id').value,
    stok_minimum:document.getElementById('stok_minimum').value,
    status:document.getElementById('status').checked,
    stock_managed:document.getElementById('stock_managed').checked,
    prices
  };
  const btn=document.getElementById('saveProduct');btn.disabled=true;
  try{
    const url=mode==='edit'?`/inventory/api/products/${encodeURIComponent(body.prdid)}`:'/inventory/api/products';
    const method=mode==='edit'?'PUT':'POST';
    await api(url,{method,body:JSON.stringify(body)});
    if(productModal) productModal.hide();
    if(document.getElementById('rows')) loadProducts();
    if(window.onProductSaved) window.onProductSaved();
    alert(mode==='edit'?'Produk berhasil diperbarui.':'Produk berhasil ditambahkan.');
  }catch(e){showProductError(e.message);}finally{btn.disabled=false;}
}

window.openProductModal=openProductModal;
window.editProduct=editProduct;
window.deactivateProduct=deactivateProduct;

document.addEventListener('DOMContentLoaded',()=>{
  const add=document.getElementById('addProduct');
  if(add) add.onclick=()=>openProductModal();
  const addPrice=document.getElementById('addPriceRow');
  if(addPrice) addPrice.onclick=()=>priceRow();
  const form=document.getElementById('productForm');
  if(form) form.addEventListener('submit',saveProduct);
  const search=document.getElementById('search');
  if(search) search.onkeydown=e=>{if(e.key==='Enter'){page=1;loadProducts().catch(err=>alert(err.message));}};
  const prev=document.getElementById('prev'); if(prev) prev.onclick=()=>{if(page>1){page--;loadProducts().catch(err=>alert(err.message));}};
  const next=document.getElementById('next'); if(next) next.onclick=()=>{page++;loadProducts().catch(err=>alert(err.message));};
  if(document.getElementById('rows')) loadProducts().catch(e=>alert(e.message));
});
