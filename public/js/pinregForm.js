const $ = (id) => document.getElementById(id);
const PC = window.PINREG_PRICECODE || '';
const S = { rows: [], products: [] };
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
async function api(url, opt) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opt,
  });
  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(j.msg || 'Request gagal.');
  return j;
}
function productOptions(sel) {
  return (
    '<option value="">Pilih produk...</option>' +
    S.products
      .map(
        (p) =>
          `<option value="${esc(p.prdid)}" ${p.prdid === sel ? 'selected' : ''}>${esc(p.prdid)} — ${esc(p.prdname || '')}</option>`
      )
      .join('')
  );
}
function render() {
  const box = $('detailRows');
  if (!S.rows.length) {
    box.innerHTML =
      '<div class="pin-empty">Belum ada produk. Klik <strong>Tambah Produk</strong> untuk mulai.</div>';
    calc();
    return;
  }
  box.innerHTML = S.rows
    .map(
      (r, i) =>
        `<div class="pin-detail row g-2 align-items-end"><div class="col-lg-3"><label class="form-label">Produk</label><select class="form-select form-select-sm" onchange="pickProduct(${i},this.value)">${productOptions(r.prdid)}</select></div><div class="col-lg-1"><label class="form-label">Price</label><input class="form-control form-control-sm readonly" value="${PC}" readonly></div><div class="col-lg-1"><label class="form-label">Qty</label><input class="form-control form-control-sm" type="number" min="1" step="1" value="${r.qty}" onchange="changeQty(${i},this.value)"></div><div class="col-lg-2"><label class="form-label">DP / Unit</label><input class="form-control form-control-sm readonly" value="${money(r.dp)}" readonly></div><div class="col-lg-2"><label class="form-label">BV / Unit</label><input class="form-control form-control-sm readonly" value="${r.bv}" readonly></div><div class="col-lg-2"><label class="form-label">PIN / Unit</label><input class="form-control form-control-sm readonly" value="${r.pin}" readonly></div><div class="col-lg-1"><button type="button" class="btn btn-outline-danger btn-sm w-100 pin-remove" onclick="removeRow(${i})"><i class="bi bi-trash"></i></button></div></div>`
    )
    .join('');
  calc();
}
function addRow(d = {}) {
  S.rows.push({
    prdid: d.prdid || '',
    qty: Number(d.qty || 1),
    dp: Number(d.dp || 0),
    bv: Number(d.bv || 0),
    pin: Number(d.pin || 0),
  });
  render();
}
function removeRow(i) {
  S.rows.splice(i, 1);
  render();
}
function changeQty(i, v) {
  S.rows[i].qty = Math.max(1, parseInt(v) || 1);
  calc();
}
async function pickProduct(i, prdid) {
  S.rows[i].prdid = prdid;
  S.rows[i].dp = S.rows[i].bv = S.rows[i].pin = 0;
  if (prdid) {
    const j = await api(`/pinreg/products/${encodeURIComponent(prdid)}/prices`);
    const p = j.data[0];
    if (!p) {
      alert(`Produk tidak memiliki pricecode ${PC}.`);
    } else
      Object.assign(S.rows[i], {
        dp: Number(p.dp || 0),
        bv: Number(p.bv || 0),
        pin: Number(p.pin || 0),
      });
  }
  render();
}
function calc() {
  let h = 0,
    b = 0,
    p = 0;
  S.rows.forEach((r) => {
    h += r.qty * r.dp;
    b += r.qty * r.bv;
    p += r.qty * r.pin;
  });
  $('totalHarga').textContent = money(h);
  $('totalBv').textContent = b.toLocaleString('id-ID');
  $('totalPin').textContent = p.toLocaleString('id-ID');
}
window.removeRow = removeRow;
window.changeQty = changeQty;
window.pickProduct = pickProduct;
async function init() {
  const j = await api('/pinreg/products');
  S.products = j.data;
  if (window.PINREG_EDIT) {
    const x = await api(
      '/pinreg/load/' + encodeURIComponent(window.PINREG_ORDERNO)
    );
    const h = x.data.header;
    ['nama', 'nohp', 'usernamesp', 'namasp', 'stkid', 'registerno'].forEach(
      (n) => ($(n).value = h[n] || '')
    );
    S.rows = x.data.details.map((d) => ({
      prdid: d.prdid,
      qty: Number(d.qty || 1),
      dp: Number(d.master_dp ?? d.dp ?? 0),
      bv: Number(d.master_bv ?? d.bv ?? 0),
      pin: Number(d.master_pin ?? d.pin ?? 0),
    }));
  } else addRow();
  render();
}
$('btnTambahProduk').onclick = () => addRow();
$('pinregForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!S.rows.length) return alert('Tambahkan minimal satu produk.');
  const body = {
    nama: $('nama').value.trim(),
    nohp: $('nohp').value.trim(),
    usernamesp: $('usernamesp').value.trim(),
    namasp: $('namasp').value.trim(),
    stkid: $('stkid').value.trim(),
    registerno: $('registerno').value.trim(),
    details: S.rows.map((r) => ({ prdid: r.prdid, qty: r.qty })),
  };
  if (!body.nama) return alert('Nama wajib diisi.');
  if (S.rows.some((r) => !r.prdid || !Number.isInteger(r.qty) || r.qty <= 0))
    return alert('Periksa produk dan quantity.');
  const btn = $('btnSimpan');
  btn.disabled = true;
  try {
    const url = window.PINREG_EDIT
      ? `/pinreg/update/${encodeURIComponent(window.PINREG_ORDERNO)}`
      : '/pinreg/create';
    const j = await api(url, { method: 'POST', body: JSON.stringify(body) });
    alert(j.msg || 'Berhasil disimpan.');
    location.href = '/pinreg';
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});
init().catch((e) => alert(e.message));
