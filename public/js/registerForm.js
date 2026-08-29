const $ = (id) => document.getElementById(id);

const DATA = window.REGISTER_DATA || {};
const PRICECODE = window.REGISTER_PRICECODE || '';

const state = {
  rows: [],
  products: [],
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

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const json = await res.json();

  if (!res.ok || !json.success)
    throw new Error(json.msg || 'Request gagal.');

  return json;
}

function productOptions(selected) {
  return `
    <option value="">Pilih produk...</option>
    ${state.products.map((p) => `
      <option value="${esc(p.prdid)}"
              ${p.prdid === selected ? 'selected' : ''}>
        ${esc(p.prdid)} — ${esc(p.prdname || '')} (${number(p.pin)} PIN)
      </option>
    `).join('')}
  `;
}

function addRow(row = {}) {
  state.rows.push({
    username: row.username || '',
    usernamesp: row.usernamesp || '',
    prdid: row.prdid || '',
    pin: Number(row.pin || 0),
    keterangan: row.keterangan || '',
  });

  render();
}

function removeRow(index) {
  state.rows.splice(index, 1);
  render();
}

function render() {
  const box = $('detailRows');

  if (!state.rows.length) {
    box.innerHTML = `
      <div class="reg-empty">
        Belum ada member baru. Klik <strong>Tambah Register Member</strong>.
      </div>
    `;
    calc();
    return;
  }

  box.innerHTML = state.rows.map((r, i) => `
    <div class="reg-detail">
      <div class="row g-2 align-items-end">
        <div class="col-xl-2 col-md-6">
          <label class="form-label small fw-semibold">USERNAME *</label>
          <input class="form-control form-control-sm"
                 maxlength="30"
                 value="${esc(r.username)}"
                 oninput="changeText(${i}, 'username', this.value)">
        </div>

        <div class="col-xl-2 col-md-6">
          <label class="form-label small fw-semibold">USERNAMESP</label>
          <input class="form-control form-control-sm"
                 maxlength="30"
                 value="${esc(r.usernamesp)}"
                 oninput="changeText(${i}, 'usernamesp', this.value)">
        </div>

        <div class="col-xl-3 col-md-6">
          <label class="form-label small fw-semibold">PRDID *</label>
          <select class="form-select form-select-sm"
                  onchange="pickProduct(${i}, this.value)">
            ${productOptions(r.prdid)}
          </select>
        </div>

        <div class="col-xl-1 col-md-3">
          <label class="form-label small fw-semibold">JML.PIN</label>
          <input class="form-control form-control-sm readonly"
                 readonly value="${number(r.pin)}">
        </div>

        <div class="col-xl-3 col-md-6">
          <label class="form-label small fw-semibold">KETERANGAN</label>
          <input class="form-control form-control-sm"
                 maxlength="80"
                 value="${esc(r.keterangan)}"
                 oninput="changeText(${i}, 'keterangan', this.value)">
        </div>

        <div class="col-xl-1 col-md-3">
          <button type="button"
                  class="btn btn-outline-danger btn-sm w-100"
                  onclick="removeRow(${i})"
                  title="Hapus baris">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  calc();
}

function changeText(index, field, value) {
  state.rows[index][field] = value;
}

async function pickProduct(index, prdid) {
  state.rows[index].prdid = prdid;
  state.rows[index].pin = 0;

  if (prdid) {
    const product = state.products.find((p) => p.prdid === prdid);

    if (!product) {
      alert('Produk tidak ditemukan untuk pricecode aktif.');
    } else {
      state.rows[index].pin = Number(product.pin || 0);
    }
  }

  render();
}

function calc() {
  const bought = Number(DATA.tpin || 0);
  const alreadyUsed = Number(DATA.pinUsed || 0);

  const newUsed = state.rows.reduce(
    (sum, row) => sum + Number(row.pin || 0),
    0
  );

  const remain = bought - alreadyUsed - newUsed;

  $('totalUsed').textContent = number(newUsed);
  $('totalRemain').textContent = number(Math.max(remain, 0));

  const box = $('statusBox');

  if (!state.rows.length) {
    box.className = 'alert alert-secondary mt-3 mb-0';
    box.textContent = 'Tambahkan member baru untuk melakukan registrasi.';
    return;
  }

  if (state.rows.some((r) => !r.username.trim() || !r.prdid)) {
    box.className = 'alert alert-warning mt-3 mb-0';
    box.textContent = 'Lengkapi username dan produk setiap baris.';
    return;
  }

  if (remain < 0) {
    box.className = 'alert alert-danger mt-3 mb-0';
    box.textContent =
      `PIN tidak mencukupi. Sisa PIN saat ini ${number(bought - alreadyUsed)}, ` +
      `sedangkan tambahan registrasi membutuhkan ${number(newUsed)} PIN.`;
  } else {
    box.className = 'alert alert-success mt-3 mb-0';
    box.textContent =
      `PIN mencukupi. Setelah disimpan, sisa PIN menjadi ${number(remain)}.`;
  }
}

window.removeRow = removeRow;
window.changeText = changeText;
window.pickProduct = pickProduct;

$('btnTambah').onclick = () => addRow();

$('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!state.rows.length)
    return alert('Tambahkan minimal satu member.');

  for (let i = 0; i < state.rows.length; i++) {
    const r = state.rows[i];

    if (!r.username.trim())
      return alert(`Baris ${i + 1}: username wajib diisi.`);

    if (!r.prdid)
      return alert(`Baris ${i + 1}: produk wajib dipilih.`);
  }

  const duplicate = new Set();

  for (const row of state.rows) {
    const key = row.username.trim().toLowerCase();

    if (duplicate.has(key))
      return alert(`Username ${row.username} dimasukkan lebih dari satu kali.`);

    duplicate.add(key);
  }

  const btn = $('btnSimpan');
  btn.disabled = true;

  try {
    const body = {
      rows: state.rows.map((r) => ({
        username: r.username.trim(),
        usernamesp: r.usernamesp.trim(),
        prdid: r.prdid,
        keterangan: r.keterangan.trim(),
      })),
    };

    const j = await api(
      `/register/save/${encodeURIComponent(DATA.registerno)}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    alert(j.msg || 'Registrasi berhasil disimpan.');
    location.href =
      `/register/form/${encodeURIComponent(DATA.registerno)}`;
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

async function init() {
  const j = await api('/register/products');
  state.products = j.data || [];

  // Mulai dengan satu baris kosong.
  addRow();
}

init().catch((e) => alert(e.message));
