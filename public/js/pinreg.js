const $ = (id) => document.getElementById(id);
const state = { page: 1, limit: 20, search: '' };
const money = (v) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(v || 0));
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[c]
  );

async function loadData() {
  const qs = new URLSearchParams({
    page: state.page,
    limit: state.limit,
    search: state.search,
  });
  const res = await fetch('/pinreg/load?' + qs);
  const json = await res.json();
  if (!res.ok || !json.success)
    throw new Error(json.msg || 'Gagal mengambil data.');
  const x = json.data;
  $('statTotal').textContent = x.total.toLocaleString('id-ID');
  $('statShown').textContent = x.rows.length.toLocaleString('id-ID');
  $('statLunas').textContent = x.rows
    .filter((r) => r.stbayar === true || r.stbayar === 1 || r.stbayar === '1')
    .length.toLocaleString('id-ID');
  $('rows').innerHTML = x.rows.length
    ? x.rows
        .map(
          (r) =>
            `<tr><td><a class="fw-bold text-primary text-decoration-none" href="/pinreg/form/${encodeURIComponent(r.orderno)}">${esc(r.orderno)}</a></td><td>${esc(r.registerno || '-')}</td><td><strong>${esc(r.nama || '-')}</strong></td><td>${esc(r.usernamesp || '-')}</td><td>${r.createdt ? new Date(r.createdt).toLocaleDateString('id-ID') : '-'}</td><td class="text-end">${money(r.total_harga)}</td><td class="text-end">${Number(r.total_pin || 0).toLocaleString('id-ID')}</td><td class="text-end">${Number(r.total_bv || 0).toLocaleString('id-ID')}</td><td>${r.stbayar === true ? '<span class="badge text-bg-success">sudah</span>' : '<span class="badge text-bg-secondary">belum</span>'}</td><td><a class="btn btn-sm btn-outline-primary" href="/pinreg/form/${encodeURIComponent(r.orderno)}">Buka</a></td></tr>`
        )
        .join('')
    : '<tr><td colspan="10" class="text-center py-5 text-secondary">Belum ada transaksi.</td></tr>';
  const pages = Math.max(1, Math.ceil(x.total / x.limit));
  $('pageInfo').textContent = `Halaman ${x.page} / ${pages}`;
  $('prev').disabled = x.page <= 1;
  $('next').disabled = x.page >= pages;
}
$('btnTambah').onclick = () => (location.href = '/pinreg/form');
$('prev').onclick = () => {
  if (state.page > 1) {
    state.page--;
    loadData();
  }
};
$('next').onclick = () => {
  state.page++;
  loadData();
};
let timer;
$('search').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    state.search = e.target.value;
    state.page = 1;
    loadData();
  }, 250);
});
loadData().catch(
  (e) =>
    ($('rows').innerHTML =
      `<tr><td colspan="9" class="text-center text-danger py-5">${esc(e.message)}</td></tr>`)
);
