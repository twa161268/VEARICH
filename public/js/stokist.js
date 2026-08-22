let mode = 'insert'; // default
let selectedIDK = null;

// tombol tampilkan form
document.getElementById('btnShowForm').addEventListener('click', () => {
  mode = 'insert';
  selectedIDK = null;

  const form = document.getElementById('mainForm');
  form.style.display = 'block';

  // kosongkan input
  document.getElementById('stkid').value = '';
  document.getElementById('namastk').value = '';
  document.getElementById('username').value = '';
  document.getElementById('alamat').value = '';
  document.getElementById('telepon').value = '';
  document.getElementById('wilayah').value = '';
  document.getElementById('kota').value = '';
  document.getElementById('tgljoin').value = '';
  document.getElementById('grade').value = '';
  document.getElementById('persentase').value = '';
  document.getElementById('stktype').value = '';

  document.getElementById('stkid').readOnly = false;
});

async function masukin() {
  console.log('MULAI INPUT DATA');
  const send = {};

  // =====================
  // FIELD UTAMA
  // =====================

  //send.idk = document.getElementById("idk").value;
  //send.nama = document.getElementById("nama").value;
  //send.jabatan = document.getElementById("jabatan").value;

  send.stkid = document.getElementById('stkid').value = '';
  send.namastk = document.getElementById('namastk').value = '';
  send.username = document.getElementById('username').value = '';
  send.alamat = document.getElementById('alamat').value = '';
  send.telepon = document.getElementById('telepon').value = '';
  send.wilayah = document.getElementById('wilayah').value = '';
  send.kota = document.getElementById('kota').value = '';
  send.tgljoin = document.getElementById('tgljoin').value = '';
  send.grade = document.getElementById('grade').value = '';
  send.persentase = document.getElementById('persentase').value = '';
  send.stktype = document.getElementById('stktype').value = '';

  // =====================
  // KIRIM KE SERVER (CONTROLLERS stokistController)
  // =====================
  const res = await fetch('/stokist/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(send),
  });

  const result = await res.json();

  if (result.success) {
    alert('Data berhasil diinput!');
  } else {
    alert('Gagal input data!');
  }
}

//UPDATE  DATA

document.getElementById('btnSimpan').addEventListener('click', async () => {
  await simpan();
});

document.getElementById('btnBatal').addEventListener('click', async () => {
  document.getElementById('mainForm').style.display = 'none';
  await loadDatak();
});

async function simpan() {
  const send = {
    //idk: document.getElementById("idk").value,
    //nama: document.getElementById("nama").value,
    //jabatan: document.getElementById("jabatan").value
    stkid: document.getElementById('stkid').value,
    namastk: document.getElementById('namastk').value,
    username: document.getElementById('username').value,
    alamat: document.getElementById('alamat').value,
    telepon: document.getElementById('telepon').value,
    wilayah: document.getElementById('wilayah').value,
    kota: document.getElementById('kota').value,
    tgljoin: document.getElementById('tgljoin').value,
    grade: document.getElementById('grade').value,
    persentase: document.getElementById('persentase').value,
    stktype: document.getElementById('stktype').value,
  };

  let url = '';

  if (mode === 'insert') {
    url = '/stokist/create'; // INSERT
  } else {
    url = '/stokist/update'; // UPDATE
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(send),
  });

  const result = await res.json();

  if (result.success) {
    alert(
      mode === 'insert' ? 'Data berhasil ditambah!' : 'Data berhasil diupdate!'
    );

    // reset form
    document.getElementById('mainForm').style.display = 'none';
    await loadDatak();
  } else {
    alert('Gagal menyimpan data!');
  }
}

// helper
function getForm() {
  return {
    //idk: document.getElementById("idk").value,
    //nama: document.getElementById("nama").value,
    //jabatan: document.getElementById("jabatan").value
    stkid: document.getElementById('stkid').value,
    namastk: document.getElementById('namastk').value,
    username: document.getElementById('username').value,
    alamat: document.getElementById('alamat').value,
    telepon: document.getElementById('telepon').value,
    wilayah: document.getElementById('wilayah').value,
    kota: document.getElementById('kota').value,
    tgljoin: document.getElementById('tgljoin').value,
    grade: document.getElementById('grade').value,
    persentase: document.getElementById('persentase').value,
    stktype: document.getElementById('stktype').value,
  };
}

async function loadDatak() {
  return new Promise(async (resolve) => {
    const res = await fetch(`/stokist/load`);
    const data = await res.json();

    //console.log("Data yang diterima:",data.loadData); // <-- pastikan struktur data benar

    const tbody = document.querySelector('#tblStokist tbody');
    tbody.innerHTML = '';

    if (data.success && data.data.length > 0) {
      data.data.forEach((row) => {
        //console.log(`Loading row: ${row.idk}, ${row.period}, Period: ${String(row.period).substring(0, 7)}`);
        tbody.innerHTML += `
            <tr>
            <td onclick="selectRow('${row.stkid}')">${row.stkid}</td>
            <td>${row.stkid}</td>
            <td>${row.namastk}</td>
            <td>${row.username}</td>

            <td class="text-center">
                <input type="checkbox" class="chkRow"
               data-idk="${row.stkid}"
               style="transform: scale(1.2);">
            </td>
            </tr>
            `;
      });
      rebindCheckboxEvents();
    } else {
      tbody.innerHTML = `
            <tr><td colspan="4" class="text-center text-danger">Gak ada ada data</td></tr>
        `;
    }
    resolve(); //  <-- penting
  });
}

function rebindCheckboxEvents() {
  const chkAll = document.getElementById('chkHeaderk');
  const chkRows = document.querySelectorAll('.chkRow');

  // Event header
  chkAll.onchange = () => {
    chkRows.forEach((chk) => (chk.checked = chkAll.checked));
  };

  // Event baris
  chkRows.forEach((chk) => {
    chk.onchange = () => {
      const allChecked = [...chkRows].every((c) => c.checked);
      chkAll.checked = allChecked;
    };
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadDatak();
});

async function selectRow(xIDK) {
  mode = 'edit';
  selectedIDK = xIDK;

  const form = document.getElementById('mainForm');
  form.style.display = 'block';

  //const periode = document.getElementById("stkid").value;
  //console.log("Selected STKID:", xIDK); // Debug: pastikan STKID
  document.getElementById('stkid').readOnly = true;

  try {
    document.body.style.cursor = 'wait';
    const res = await fetch(`/stokist/load/${xIDK}`);

    if (!res.ok) throw new Error('Fetch gagal');

    const result = await res.json();

    // ✅ TARUH DI SINI
    if (!result.success) {
      alert('Gagal ambil data');
      return;
    }

    // baru ambil row
    const row = result.data;
    //const row = result.data[0];
    if (!row) {
      alert('Data tidak ditemukan!');
      return;
    }

    document.getElementById('stkid').value = row.stkid;
    document.getElementById('namastk').value = row.namastk;
    document.getElementById('username').value = row.username;
    document.getElementById('alamat').value = row.alamat;
    document.getElementById('telepon').value = row.telepon;
    document.getElementById('wilayah').value = row.wilayah;
    document.getElementById('kota').value = row.kota;
    document.getElementById('tgljoin').value = row.tgljoin;
    document.getElementById('grade').value = row.grade;
    document.getElementById('persentase').value = row.persentase;
    document.getElementById('stktype').value = row.stktype;
  } catch (err) {
    console.error(err);
    alert('Terjadi error');
  } finally {
    document.body.style.cursor = 'default';
  }
}

document.getElementById('btnCarik').addEventListener('click', function () {
  let keyword = document.getElementById('carik').value.toLowerCase();
  let table = document.getElementById('tblStokist');
  let rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');

  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    let text = row.innerText.toLowerCase();
    //let nama = row.cells[2].innerText.toLowerCase(); // kolom NAMA

    if (text.includes(keyword)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  }
});

//DELETE DATA
document.getElementById('btnDeletek').addEventListener('click', async () => {
  const selected = document.querySelectorAll('.chkRow:checked');
  if (selected.length === 0) {
    alert('Tidak ada data yang dipilih!');
    return;
  }

  if (!confirm('Hapus semua data yang dipilih?')) return;

  const list = [];
  selected.forEach((c) => {
    list.push({
      stkid: c.dataset.stkid,
    });
  });
  //console.log("Data yang akan dihapus:", list);

  const res = await fetch('/stokist/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: list }),
  });

  const json = await res.json();

  if (json.success) {
    alert('Data berhasil dihapus!');
    document.getElementById('mainForm').style.display = 'none';
    await loadDatak();
  } else {
    alert('Gagal menghapus data.');
  }
});
