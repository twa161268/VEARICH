(async function(){
  const mount=document.getElementById('inventoryContext');
  if(!mount) return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  try{
    const r=await fetch('/inventory/api/context');
    const j=await r.json();
    if(!r.ok||!j.success) throw new Error(j.msg||'Gagal membaca konteks inventory.');
    mount.className='container-fluid px-3 px-lg-4 pt-3';
    if(j.isAdmin){
      mount.innerHTML=`<div class="card border-0 shadow-sm mb-3"><div class="card-body py-2 d-flex flex-wrap align-items-center gap-2">
        <strong>Stockist / Gudang:</strong>
        <select id="inventoryContextSelect" class="form-select form-select-sm" style="max-width:360px">
          <option value="">SEMUA STOCKIST</option>
          ${j.stockists.map(x=>`<option value="${esc(x.stkid)}" ${j.selectedStkid===x.stkid?'selected':''}>${esc(x.stkid)} - ${esc(x.namastk||'')}</option>`).join('')}
        </select>
        <small class="text-secondary">Pilih stockist untuk mengelola transaksi/gudang tertentu. SEMUA digunakan untuk melihat data global.</small>
      </div></div>`;
      document.getElementById('inventoryContextSelect').addEventListener('change',async e=>{
        const rr=await fetch('/inventory/context',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stkid:e.target.value||null})});
        const jj=await rr.json();
        if(!rr.ok||!jj.success){alert(jj.msg||'Gagal mengubah stockist.');return;}
        location.reload();
      });
    }else{
      mount.innerHTML=`<div class="card border-0 shadow-sm mb-3"><div class="card-body py-2">
        <strong>Stockist aktif:</strong> ${esc(j.sessionStkid||'-')} <span class="badge text-bg-light ms-2">terkunci oleh login</span>
      </div></div>`;
    }
  }catch(e){mount.innerHTML=`<div class="alert alert-danger">${esc(e.message)}</div>`;}
})();
