const $=id=>document.getElementById(id);
const money=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
async function api(url,opt={}){const r=await fetch(url,{headers:{'Content-Type':'application/json'},...opt});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.msg||'Request gagal.');return j;}
let page=1,limit=20,total=0,search='';
async function load(){
 const qs=new URLSearchParams({page,limit,search});if(window.TX_ADMIN&&$('stockistFilter')?.value)qs.set('stkid',$('stockistFilter').value);const j=await api('/transaksi/load?'+qs);
 total=j.data.total;$('statTotal').textContent=total;$('statShown').textContent=j.data.rows.length;
 $('statPin').textContent=j.data.rows.reduce((s,r)=>s+Number(r.jumlah_transaksi||0),0);
 $('rows').innerHTML=j.data.rows.length?j.data.rows.map(r=>{
   const tagihan=Number(r.bayar||0),bayar=Number(r.total_bayar||0);
   const status=Math.abs(bayar-tagihan)<.01?'LUNAS':bayar<tagihan?'KURANG':'LEBIH';
   return `<tr>
   <td>${esc(r.stkid||'-')}</td><td><a class="fw-bold text-decoration-none" href="/transaksi/form/${encodeURIComponent(r.registerno)}">${esc(r.registerno)}</a></td>
   <td><span class="badge text-bg-primary">${r.jumlah_transaksi}</span></td><td>${esc(r.namakirim||'-')}</td><td>${esc(r.kota||'-')}</td>
   <td class="text-end">${money(r.total_dp)}</td><td class="text-end">${money(r.ongkir)}</td><td class="text-end fw-semibold">${money(r.bayar)}</td><td class="text-end">${money(r.total_bayar)}</td>
   <td><span class="badge ${status==='LUNAS'?'text-bg-success':status==='KURANG'?'text-bg-warning':'text-bg-danger'}">${status}</span></td>
   <td><div class="d-flex gap-1"><a class="btn btn-sm btn-outline-primary" href="/transaksi/form/${encodeURIComponent(r.registerno)}"><i class="bi bi-pencil"></i></a><button class="btn btn-sm btn-outline-danger" onclick="hapus('${esc(r.registerno)}')"><i class="bi bi-trash"></i></button></div></td>
   </tr>`;
 }).join(''):'<tr><td colspan="11" class="text-center py-5 text-secondary">Belum ada data.</td></tr>';
 $('pageInfo').textContent=`Halaman ${page} dari ${Math.max(1,Math.ceil(total/limit))}`;
 $('prev').disabled=page<=1;$('next').disabled=page>=Math.ceil(total/limit);
}
const btnNewTx=$('btnNewTx');if(btnNewTx&&window.TX_ADMIN)btnNewTx.onclick=e=>{e.preventDefault();const v=$('stockistFilter')?.value||'';location.href='/transaksi/form'+(v?'?stkid='+encodeURIComponent(v):'');};
const stockistFilter=$('stockistFilter');if(stockistFilter)stockistFilter.addEventListener('change',()=>{page=1;load()});
window.hapus=async reg=>{if(!confirm(`Hapus register ${reg}? Semua transaksi PIN dan pembayaran di dalamnya akan dihapus.`))return;try{await api(`/transaksi/${encodeURIComponent(reg)}`,{method:'DELETE',body:JSON.stringify({stkid:window.TX_ADMIN?($('stockistFilter')?.value||''):null})});await load();}catch(e){alert(e.message)}};
$('search').addEventListener('input',()=>{search=$('search').value;page=1;load().catch(e=>alert(e.message));});
$('prev').onclick=()=>{if(page>1){page--;load();}};$('next').onclick=()=>{if(page<Math.ceil(total/limit)){page++;load();}};
load().catch(e=>{$('rows').innerHTML=`<tr><td colspan="11" class="text-center text-danger py-5">${esc(e.message)}</td></tr>`;});
