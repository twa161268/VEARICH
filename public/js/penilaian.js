// penilaian.js
let mode = ""; // "add" atau "edit"
let refData = {}; // referensi dari TABELREF_NILAI
let selectedIDK = ""; // IDK dari row yang diklik


// ========== 1. LOAD REFERENSI NILAI ==========
async function loadReferensi() {
    const res = await fetch("/refnilai");
    refData = await res.json();
}

async function loadData() {  
    return new Promise(async (resolve) => {
    const periode = document.getElementById("periode").value;
   
    if (!periode) {
        alert("Silakan pilih periode!");
        return resolve();
    }
    //console.log("MULAI LOAD DATA UNTUK PERIODE:", periode);
    const res = await fetch(`/nilai/load/${periode}`);
    const data = await res.json();

    //console.log("Data yang diterima:",data.loadData); // <-- pastikan struktur data benar

    const tbody = document.querySelector("#tblPenilaian tbody");
    tbody.innerHTML = "";

    if (data.success && data.data.length > 0) {
        data.data.forEach(row => {
            //console.log(`Loading row: ${row.idk}, ${row.period}, Period: ${String(row.period).substring(0, 7)}`);
            tbody.innerHTML += `
            <tr onclick="selectRow('${row.idk}', '${row.period}')">
            <td>${String(row.period).substring(0, 7)}</td>
            <td>${row.idk}</td>
            <td>${row.nama}</td>
            <td class="text-end">${row.totalpersen}</td>
            <td class="text-end">${Number(row.bnsactual).toLocaleString("en-US")}</td>
            <td class="text-center">
                <input type="checkbox" class="chkRow" 
               data-idk="${row.idk}" 
               data-period="${row.period}" 
               style="transform: scale(1.2);">
            </td>
            </tr>
            `;
        });
        rebindCheckboxEvents();
    } else {
        tbody.innerHTML = `
            <tr><td colspan="4" class="text-center text-danger">Tidak ada data</td></tr>
        `;
    }
            resolve();   //  <-- penting
    });
};

document.getElementById("btnLoad").addEventListener("click", async () => {
    console.log("Tombol Load diklik");
    await loadData(); 
})



function rebindCheckboxEvents() {
    const chkAll = document.getElementById("chkHeader");
    const chkRows = document.querySelectorAll(".chkRow");


// Event header
    chkAll.onchange = () => {
        chkRows.forEach(chk => chk.checked = chkAll.checked);
    };

    // Event baris
    chkRows.forEach(chk => {
        chk.onchange = () => {
            const allChecked = [...chkRows].every(c => c.checked);
            chkAll.checked = allChecked;
        };
    });
}


document.getElementById("btnDelete").addEventListener("click", async () => {
    const selected = document.querySelectorAll(".chkRow:checked");
    if (selected.length === 0) {
        alert("Tidak ada data yang dipilih!");
        return;
    }

    if (!confirm("Hapus semua data yang dipilih?")) return;

    const list = [];
    selected.forEach(c => {
        list.push({
            idk: c.dataset.idk,
            period: c.dataset.period
        });
    });
    //console.log("Data yang akan dihapus:", list);


    const res = await fetch("/nilai/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: list })
    });

    const json = await res.json();


    if (json.success) {
        alert("Data berhasil dihapus!");
        await loadData(); // reload table
    } else {
        alert("Gagal menghapus data.");
    }
});



// ========== 4. KLIK ROW LISTING ==========
async function selectRow(IDK, PERIOD) {
    mode = "edit";
    selectedIDK = IDK;

    const periode = document.getElementById("periode").value;


    try {
        document.body.style.cursor = "wait";

        if (!refData || Object.keys(refData).length === 0) {
            await loadReferensi();
        }

        const res = await fetch(`/nilaiidk/load/${periode}/${IDK}`);

        if (!res.ok) throw new Error("Fetch gagal");

        const result = await res.json();

        // ✅ TARUH DI SINI
        if (!result.success) {
            alert("Gagal ambil data");
            return;
        }

        // baru ambil row
        const row = result.data;
        //const row = result.data[0];
        if (!row) {
            alert("Data tidak ditemukan!");
            return;
        }


        const resk = await fetch(`/karyawan/load/${IDK}`);
        const karyawan = await resk.json();

        if (!karyawan) {
            alert("Data karyawan tidak ditemukan!");
            return;
        }

        document.getElementById("idk").value = row.idk;
        document.getElementById("nama").value = row.nama;
        document.getElementById("jabatan").innerText = karyawan.jabatan;
        document.getElementById("bonus").value = row.nilaibonus || 0;

        const fields = [
            "cutisakit","telatu30","telatd30","telatu60","lupa",
            "hadirfull","ontime","ovrmnt","kerjalibur","reward",
            "lalai","tunda","alpha"
        ];

        const fields2 = [
            "cutisakita","telatu30a","telatd30a","telatu60a","lupaa",
            "hadirfulla","ontimea","ovrmnta","kerjalibura","rewarda",
            "lalaia","tundaa","alphaa"
        ];

        fields.forEach((f, i) => {
            document.getElementById(`tx${i+1}`).value = row[f] || 0;
        });

        fields2.forEach((g, i) => {
            document.getElementById(`ref${i+1}`).innerText = refData[g] || 0;
        });

        hitungHasil();

    } catch (err) {
        console.error(err);
        alert("Terjadi error");
    } finally {
        document.body.style.cursor = "default";
    }
}

// ========== 5. HITUNG HASIL ==========
function hitungHasil() {

    let ttlnl = 0; // harus dideklarasikan dulu
    let xsumin =0;
    let xjbonus =0;
    let xactual =0;

    for (let i = 1; i <= 13; i++) {
        const tx = Number(document.getElementById(`tx${i}`).value || 0);
        const ref = Number(document.getElementById(`ref${i}`).innerText || 0);
        const hasil = tx * ref;
        document.getElementById(`hasil${i}`).innerText = hasil.toFixed(2);
        ttlnl += hasil;
    }

        const xbonus = Number(document.getElementById("bonus").value || 0);
        xsumin = (ttlnl/100)*xbonus;
        xjbonus = xsumin + xbonus;
        if (xjbonus > (xbonus*2)) {
            xactual = xbonus*2;
        } else {
            xactual = xjbonus;
        }   

        document.getElementById(`totalnilai`).innerText = ttlnl.toFixed(2);
        document.getElementById(`totalpersen`).innerText = ttlnl.toFixed(2) + "%";
        document.getElementById("sumin").innerText = xsumin.toLocaleString("en-US");
        document.getElementById("jmlbonus").innerText = xjbonus.toLocaleString("en-US");
        document.getElementById("bonusactual").innerText = xactual.toLocaleString("en-US");

}

document.addEventListener("DOMContentLoaded", async () => {
    await loadReferensi();

    // Tambahkan event ke semua TX input
    for (let i = 1; i <= 13; i++) {
        document.getElementById(`tx${i}`).addEventListener("input", hitungHasil);
    }
});


// ========== 6. SIMPAN DATA (UPDATE) ==========

document.getElementById("btnSimpan").addEventListener("click", async () => {
    await simpanData();
});


async function simpanData() {
    console.log("MULAI UPDATE DATA");
    const periode = document.getElementById("periode").value;
    if (!periode) return alert("Periode belum diisi!");

    const send = {};

    // =====================
    // FIELD UTAMA
    // =====================
    send.period = periode;
    send.idk = document.getElementById("idk").value;
    send.nama = document.getElementById("nama").value;
    send.jabatan = document.getElementById("jabatan").innerText;
    send.nilaibonus = Number(document.getElementById("bonus").value || 0);


    send["cutisakit"] = Number(document.getElementById("tx1").value || 0);
    send["telatu30"] = Number(document.getElementById("tx2").value || 0);
    send["telatd30"] = Number(document.getElementById("tx3").value || 0);
    send["telatu60"] = Number(document.getElementById("tx4").value || 0);
    send["lupa"] = Number(document.getElementById("tx5").value || 0);
    send["hadirfull"] = Number(document.getElementById("tx6").value || 0);
    send["ontime"] = Number(document.getElementById("tx7").value || 0);
    send["ovrmnt"] = Number(document.getElementById("tx8").value || 0);
    send["kerjalibur"] = Number(document.getElementById("tx9").value || 0);
    send["reward"] = Number(document.getElementById("tx10").value || 0);
    send["lalai"] = Number(document.getElementById("tx11").value || 0);
    send["tunda"] = Number(document.getElementById("tx12").value || 0);
    send["alpha"] = Number(document.getElementById("tx13").value || 0);

    send["cutisakita"] = Number(document.getElementById("ref1").innerText || 0);
    send["telatu30a"] = Number(document.getElementById("ref2").innerText || 0);
    send["telatd30a"] = Number(document.getElementById("ref3").innerText || 0);
    send["telatu60a"] = Number(document.getElementById("ref4").innerText || 0);
    send["lupaa"] = Number(document.getElementById("ref5").innerText || 0);
    send["hadirfulla"] = Number(document.getElementById("ref6").innerText || 0);
    send["ontimea"] = Number(document.getElementById("ref7").innerText || 0);
    send["ovrmnta"] = Number(document.getElementById("ref8").innerText || 0);
    send["kerjalibura"] = Number(document.getElementById("ref9").innerText || 0);
    send["rewarda"] = Number(document.getElementById("ref10").innerText || 0);
    send["lalaia"] = Number(document.getElementById("ref11").innerText || 0);
    send["tundaa"] = Number(document.getElementById("ref12").innerText || 0);
    send["alphaa"] = Number(document.getElementById("ref13").innerText || 0);

    send["cutisakitb"] = Number(document.getElementById("hasil1").innerText || 0);
    send["telatu30b"] = Number(document.getElementById("hasil2").innerText || 0);
    send["telatd30b"] = Number(document.getElementById("hasil3").innerText || 0);
    send["telatu60b"] = Number(document.getElementById("hasil4").innerText || 0);
    send["lupab"] = Number(document.getElementById("hasil5").innerText || 0);
    send["hadirfullb"] = Number(document.getElementById("hasil6").innerText || 0);
    send["ontimeb"] = Number(document.getElementById("hasil7").innerText || 0);
    send["ovrmntb"] = Number(document.getElementById("hasil8").innerText || 0);
    send["kerjaliburb"] = Number(document.getElementById("hasil9").innerText || 0);
    send["rewardb"] = Number(document.getElementById("hasil10").innerText || 0);
    send["lalaib"] = Number(document.getElementById("hasil11").innerText || 0);
    send["tundab"] = Number(document.getElementById("hasil12").innerText || 0);
    send["alphab"] = Number(document.getElementById("hasil13").innerText || 0);
    // =====================
    // HITUNG TOTALS, TOTALR, TOTALP
    // =====================
    send.totals =
    send.cutisakitb + send.telatu30b + send.telatd30b + send.telatu60b + send.lupab;      
    //send.HASIL1 + send.HASIL2 + send.HASIL3 + send.HASIL4 + send.HASIL5;

    send.totalr =
    send.hadirfullb + send.ontimeb + send.ovrmntb + send.kerjaliburb + send.rewardb;      
          //send.HASIL6 + send.HASIL7 + send.HASIL8 + send.HASIL9 + send.HASIL10;
    send.totalp =
    send.lalaib + send.tundab + send.alphab
    //send.HASIL11 + send.HASIL12 + send.HASIL13;`

    // =====================
    // NILAI LAIN
    // =====================
    send.totalnilai = Number(document.getElementById("totalnilai").innerText || 0);
    send.totalpersen = Number(document.getElementById("totalpersen").innerText.replace("%","") || 0);
    send.surplusmin = Number(document.getElementById("sumin").innerText.replace(/,/g,"") || 0);
    send.jmlbonus = Number(document.getElementById("jmlbonus").innerText.replace(/,/g,"") || 0);
    send.bnsactual = Number(document.getElementById("bonusactual").innerText.replace(/,/g,"") || 0);

    // =====================
    // KIRIM KE SERVER
    // =====================
    const res = await fetch("/simpan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(send)
    });

    const result = await res.json();

    if (result.success) {
        alert("Data berhasil disimpan!");
    } else {
        alert("Gagal menyimpan data!");
    }
}

//buat kalau tombol generate data diclick
async function generatedata() {
  try {
    const period = document.getElementById('periode').value;
    console.log("MULAI GENERATEDATA",period);
    if (!period) {
      alert("Period wajib diisi");
      return;
    }

    const res = await fetch('/nilai/tambah', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ period })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Gagal");
    }

    await loadData(); // reload table
    alert(data.message);

  } catch (err) {
    console.error(err);
    alert(err.message);
    //alert("NGACO!!");
  }
}


document.getElementById("btnTambah").addEventListener("click", async () => {
    await generatedata();
});


document.getElementById("btnCari").addEventListener("click", function () {
    let keyword = document.getElementById("cari").value.toLowerCase();
    let table = document.getElementById("tblPenilaian");
    let rows = table.getElementsByTagName("tbody")[0].getElementsByTagName("tr");

    for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        let text = row.innerText.toLowerCase();
        //let nama = row.cells[2].innerText.toLowerCase(); // kolom NAMA

        if (text.includes(keyword)) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    }
});

document.getElementById("btnRepof").addEventListener("click", function () {
    const periode = document.getElementById("periode").value;
    const idk = document.getElementById("idk").value;
    if (!periode || !idk) {
        alert("Periode dan ID Karyawan harus diisi!");
        return;
    }
    window.open(`/report/pdf?periode=${periode}&idk=${idk}`, "_blank");
});

document.getElementById("btnRepof2").addEventListener("click", function () {
    const periode = document.getElementById("periode").value;
    //const idk = document.getElementById("idk").value;

    if (!periode) {
        alert("Periode harus diisi!");
        return;
    }

    window.open(`/report/pdf2?periode=${periode}`, "_blank");
});