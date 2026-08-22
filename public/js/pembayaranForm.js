const $ = (id) => document.getElementById(id);
const S = { transactions: [], payments: [], paymentTypes: [], page: 1, limit: 20, total: 0 };
const money = (v) => new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(Number(v || 0));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

async function api(url, options = {}) {
  const res = await fetch(url, { headers:{'Content-Type':'application/json'}, ...options });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.msg || 'Request gagal.');
  return json;
}

function selectedOrders() { return S.transactions.filter(r => r.selected).map(r => r.orderno); }
function goodsTotal() { return S.transactions.filter(r => r.selected).reduce((sum, r) => sum + Number(r.total_harga || 0), 0); }
function parseMoneyInput(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
function shippingTotal() { return parseMoneyInput($('ongkir').value); }
function paymentTotal() { return S.payments.reduce((sum, p) => sum + parseMoneyInput(p.amount), 0); }

function renderTransactions() {
  $('transactionRows').innerHTML = S.transactions.length ? S.transactions.map((r, i) => `
    <tr>
      <td><strong>${esc(r.orderno)}</strong></td><td>${esc(r.nama || '-')}</td><td>${esc(r.usernamesp || '-')}</td>
      <td>${r.createdt ? new Date(r.createdt).toLocaleDateString('id-ID') : '-'}</td>
      <td class="text-end">${money(r.total_harga)}</td><td class="text-end">${Number(r.total_pin||0).toLocaleString('id-ID')}</td><td class="text-end">${Number(r.total_bv||0).toLocaleString('id-ID')}</td>
      <td><span class="badge text-bg-secondary">not yet</span></td>
      <td class="text-center"><input class="form-check-input" type="checkbox" ${r.selected ? 'checked' : ''} onchange="toggleTransaction(${i}, this.checked)"></td>
    </tr>`).join('') : '<tr><td colspan="9" class="text-center py-5 text-secondary">Tidak ada transaksi yang belum dibayar.</td></tr>';
}
window.toggleTransaction = (i, checked) => { S.transactions[i].selected = checked; calc(); };

function paymentOptions(selected) {
  return '<option value="">Pilih...</option>' + S.paymentTypes.map(p => `<option value="${esc(p.paytype)}" ${p.paytype === selected ? 'selected' : ''}>${esc(p.paytype)} - ${esc(p.deskripsi || '')}</option>`).join('');
}
function renderPayments() {
  $('paymentEmpty').classList.toggle('d-none', S.payments.length > 0);
  $('paymentRows').innerHTML = S.payments.map((p, i) => `<div class="payment-row row g-2 align-items-end">
    <div class="col-md-2"><label class="form-label small fw-semibold">Paytype</label><select class="form-select form-select-sm" onchange="changePaytype(${i},this.value)">${paymentOptions(p.paytype)}</select></div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Deskripsi</label><input class="form-control form-control-sm readonly" readonly value="${esc(p.deskripsi || '')}"></div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Amount</label><input class="form-control form-control-sm money-input" inputmode="decimal" value="${p.amount || ''}" oninput="changeAmount(${i},this.value)"></div>
    <div class="col-md-3"><label class="form-label small fw-semibold">Catatan</label><input maxlength="100" class="form-control form-control-sm" value="${esc(p.catatan || '')}" oninput="changeNote(${i},this.value)"></div>
    <div class="col-md-1"><button type="button" class="btn btn-outline-danger btn-sm w-100" onclick="removePayment(${i})"><i class="bi bi-trash3"></i></button></div>
  </div>`).join('');
}
window.changePaytype = (i, value) => { const p = S.paymentTypes.find(x => x.paytype === value); S.payments[i].paytype = value; S.payments[i].deskripsi = p?.deskripsi || ''; renderPayments(); };
window.changeAmount = (i, value) => { S.payments[i].amount = value.replace(/[^0-9.,]/g,''); calc(); };
window.changeNote = (i, value) => { S.payments[i].catatan = value; };
window.removePayment = (i) => { S.payments.splice(i,1); renderPayments(); calc(); };
$('btnAddPayment').onclick = () => { S.payments.push({ paytype:'', deskripsi:'', amount:'', catatan:'' }); renderPayments(); };

function calc() {
  const goods = goodsTotal();
  const ship = shippingTotal();
  const total = goods + ship;
  const paid = paymentTotal();
  $('totalGoods').textContent = money(goods);
  $('totalShipping').textContent = money(ship);
  $('grandTotal').textContent = money(total);
  $('totalPayment').textContent = money(paid);
  const box = $('paymentStatus');
  if (!selectedOrders().length) { box.className='alert alert-secondary mb-0'; box.textContent='Pilih minimal satu transaksi PIN.'; return; }
  if (paid === total && total > 0) { box.className='alert alert-success mb-0'; box.textContent='Total pembayaran sudah sesuai dengan total tagihan.'; }
  else if (paid < total) { box.className='alert alert-warning mb-0'; box.textContent=`Pembayaran masih kurang ${money(total-paid)}.`; }
  else { box.className='alert alert-danger mb-0'; box.textContent=`Pembayaran melebihi tagihan ${money(paid-total)}.`; }
}
$('ongkir').addEventListener('input', calc);
$('kirim').addEventListener('change', () => { const on = $('kirim').value === 'true'; if (!on) $('ongkir').value='0'; document.querySelectorAll('#namakirim,#alamat,#kelurahan,#kecamatan,#wilayah,#kota,#kodepos').forEach(el => el.disabled = !on); calc(); });
$('kirim').dispatchEvent(new Event('change'));

async function loadTransactions() {
  const qs = new URLSearchParams({ page:S.page, limit:S.limit, search:$('searchTrans').value || '' });
  const j = await api('/pembayaran/transaksi?' + qs);
  S.total = j.data.total;
  S.transactions = j.data.rows.map(r => ({...r, selected:false}));
  $('transPageInfo').textContent = `Halaman ${j.data.page} / ${Math.max(1, Math.ceil(j.data.total / j.data.limit))}`;
  $('prevTrans').disabled = j.data.page <= 1;
  $('nextTrans').disabled = j.data.page >= Math.max(1, Math.ceil(j.data.total / j.data.limit));
  renderTransactions(); calc();
}
async function init() {
  const p = await api('/pembayaran/payment');
  S.paymentTypes = p.data;
  await loadTransactions();
}
$('prevTrans').onclick = () => { if (S.page > 1) { S.page--; loadTransactions().catch(e => alert(e.message)); } };
$('nextTrans').onclick = () => { if (S.page < Math.max(1, Math.ceil(S.total / S.limit))) { S.page++; loadTransactions().catch(e => alert(e.message)); } };
let searchTimer;
$('searchTrans').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer=setTimeout(() => { S.page=1; loadTransactions().catch(e=>alert(e.message)); }, 250); });

$('paymentForm').addEventListener('submit', async e => {
  e.preventDefault();
  const ordernos = selectedOrders();
  if (!ordernos.length) return alert('Pilih minimal satu transaksi PIN.');
  const kirim = $('kirim').value === 'true';
  if (kirim && !$('namakirim').value.trim()) return alert('Nama Kirim wajib diisi.');
  const total = goodsTotal() + shippingTotal();
  const paid = paymentTotal();
  if (Math.abs(total-paid) > 0.005) return alert(paid < total ? 'Total pembayaran masih kurang.' : 'Total pembayaran melebihi total tagihan.');
  if (!S.payments.length) return alert('Minimal satu pembayaran harus diisi.');
  if (S.payments.some(p => !p.paytype || parseMoneyInput(p.amount) <= 0)) return alert('Periksa paytype dan amount pembayaran.');
  const duplicate = new Set();
  for (const p of S.payments) { if (duplicate.has(p.paytype)) return alert('Paytype yang sama tidak boleh dimasukkan dua kali.'); duplicate.add(p.paytype); }

  const body = {
    ordernos,
    kirim,
    namakirim:$('namakirim').value.trim(),
    alamat:$('alamat').value.trim(),
    kelurahan:$('kelurahan').value.trim(),
    kecamatan:$('kecamatan').value.trim(),
    wilayah:$('wilayah').value.trim(),
    kota:$('kota').value.trim(),
    kodepos:$('kodepos').value.trim(),
    ongkir:$('ongkir').value,
    payments:S.payments.map(p => ({paytype:p.paytype, amount:p.amount, catatan:p.catatan || null}))
  };
  const btn=$('btnSimpan'); btn.disabled=true;
  try {
    const j=await api('/pembayaran/create',{method:'POST',body:JSON.stringify(body)});
    alert(j.msg || 'Berhasil disimpan.');
    location.href='/pembayaran/detail/'+encodeURIComponent(j.data.header.registerno);
  } catch(err) { alert(err.message); } finally { btn.disabled=false; }
});

init().catch(e => { $('transactionRows').innerHTML=`<tr><td colspan="9" class="text-center text-danger py-5">${esc(e.message)}</td></tr>`; });
