const $ = (id) => document.getElementById(id);
const state = { page: 1, limit: 20, search: '' };
const money = (v) => new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(Number(v || 0));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

async function loadData() {
  const qs = new URLSearchParams({ page: state.page, limit: state.limit, search: state.search });
  const res = await fetch('/pembayaran/load?' + qs);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.msg || 'Gagal mengambil data.');
  const x = json.data;
  $('rows').innerHTML = x.rows.length ? x.rows.map(r => `
    <tr>
      <td><a class="fw-bold text-success text-decoration-none" href="/pembayaran/detail/${encodeURIComponent(r.registerno)}">${esc(r.registerno)}</a></td>
      <td>${r.kirim ? '<span class="badge text-bg-success">True</span>' : '<span class="badge text-bg-secondary">False</span>'}</td>
      <td>${esc(r.alamat || '-')}</td><td>${esc(r.namakirim || '-')}</td>
      <td>${esc(r.kelurahan || '-')}</td><td>${esc(r.kecamatan || '-')}</td><td>${esc(r.wilayah || '-')}</td>
      <td>${esc(r.kota || '-')}</td><td>${esc(r.kodepos || '-')}</td>
      <td class="text-end">${money(r.bayar)}</td><td class="text-end">${money(r.ongkir)}</td>
      <td class="text-center"><button class="btn btn-sm btn-link text-danger p-0" title="Hapus" onclick="deleteRegister('${esc(r.registerno)}')"><i class="bi bi-trash3 fs-5"></i></button></td>
    </tr>`).join('') : '<tr><td colspan="12" class="text-center py-5 text-secondary">Belum ada data pembayaran/pengiriman.</td></tr>';
  const pages = Math.max(1, Math.ceil(x.total / x.limit));
  $('pageInfo').textContent = `Halaman ${x.page} / ${pages}`;
  $('prev').disabled = x.page <= 1;
  $('next').disabled = x.page >= pages;
}

async function deleteRegister(registerno) {
  if (!confirm(`Hapus register ${registerno}?\n\nPembayaran terkait akan dihapus dan transaksi PIN akan dikembalikan menjadi belum bayar.`)) return;
  const res = await fetch('/pembayaran/' + encodeURIComponent(registerno), { method:'DELETE' });
  const json = await res.json();
  if (!res.ok || !json.success) return alert(json.msg || 'Gagal menghapus register.');
  await loadData();
}
window.deleteRegister = deleteRegister;
$('prev').onclick = () => { if (state.page > 1) { state.page--; loadData().catch(e => alert(e.message)); } };
$('next').onclick = () => { state.page++; loadData().catch(e => alert(e.message)); };
let timer;
$('search').addEventListener('input', e => { clearTimeout(timer); timer = setTimeout(() => { state.search = e.target.value; state.page = 1; loadData().catch(err => alert(err.message)); }, 250); });
loadData().catch(e => $('rows').innerHTML = `<tr><td colspan="12" class="text-center text-danger py-5">${esc(e.message)}</td></tr>`);
