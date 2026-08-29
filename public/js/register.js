const $ = (id) => document.getElementById(id);

const state = {
  page: 1,
  limit: 20,
  search: '',
};

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[c]);

const number = (v) => Number(v || 0).toLocaleString('id-ID');

async function loadData() {
  const qs = new URLSearchParams({
    page: state.page,
    limit: state.limit,
    search: state.search,
  });

  const res = await fetch('/register/load?' + qs);
  const json = await res.json();

  if (!res.ok || !json.success)
    throw new Error(json.msg || 'Gagal mengambil data.');

  const x = json.data;

  $('rows').innerHTML = x.rows.length
    ? x.rows.map((r) => {
        const remain = Number(r.pin_sisa || 0);
        const badge = remain > 0
          ? `<span class="badge text-bg-success">${number(remain)}</span>`
          : `<span class="badge text-bg-secondary">0</span>`;

        return `
          <tr>
            <td>
              <a class="fw-bold text-primary text-decoration-none"
                 href="/register/form/${encodeURIComponent(r.registerno)}">
                ${esc(r.registerno)}
              </a>
            </td>
            <td>${esc(r.namakirim || '-')}</td>
            <td class="text-end">${number(r.tpin)}</td>
            <td class="text-end">${number(r.pin_terpakai)}</td>
            <td class="text-end">${badge}</td>
            <td>${esc(r.stkid || '-')}</td>
            <td>${r.createdt ? new Date(r.createdt).toLocaleDateString('id-ID') : '-'}</td>
            <td class="text-center">
              <a class="btn btn-sm btn-outline-primary"
                 href="/register/form/${encodeURIComponent(r.registerno)}">
                Buka
              </a>
            </td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="8" class="text-center py-5 text-secondary">Belum ada Register No.</td></tr>`;

  const pages = Math.max(1, Math.ceil(x.total / x.limit));
  $('pageInfo').textContent = `Halaman ${x.page} / ${pages}`;
  $('prev').disabled = x.page <= 1;
  $('next').disabled = x.page >= pages;
}

$('prev').onclick = () => {
  if (state.page > 1) {
    state.page--;
    loadData().catch((e) => alert(e.message));
  }
};

$('next').onclick = () => {
  state.page++;
  loadData().catch((e) => alert(e.message));
};

let timer;
$('search').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    state.search = e.target.value;
    state.page = 1;
    loadData().catch((err) => alert(err.message));
  }, 250);
});

loadData().catch((e) => {
  $('rows').innerHTML =
    `<tr><td colspan="8" class="text-center text-danger py-5">${esc(e.message)}</td></tr>`;
});
