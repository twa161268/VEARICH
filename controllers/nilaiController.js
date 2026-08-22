// controllers/nilaiController.js

const db = require("../db");


// ambil data untu lISTING Kanan
exports.loadDataByPeriode = async (req, res) => {

    const periode = req.params.periode;
    const [tahun, bulan] = periode.split("-");
    const sql = `
    SELECT TO_CHAR(period, 'YYYY-MM-DD') as period, idk, nama, totalpersen, bnsactual
    FROM tabel_nilai
    WHERE period >= $1 AND period < $2
    `;

    //const startDate = `${tahun}-${bulan}-01`;
    const start = new Date(`${tahun}-${bulan}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    // format manual YYYY-MM-DD (tanpa UTC)
    const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
    };

    const startDate = formatDate(start);
    const endDate = formatDate(end);
    
    try {
        //const rows = await db.query(sql);
        const rows = await db.query(sql, [startDate, endDate]);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.json({ success: false });
    }
};

//ambil data untuk panel kiri
exports.loadDataByPeriodeidk = async (req, res) => {
    const periode = req.params.periode;
    const [tahun, bulan] = periode.split("-");
    const idk = req.params.idk;

    const sql = `
    SELECT *
    FROM tabel_nilai
    WHERE period >= $1 AND period < $2 AND idk = $3
`;

    const start = new Date(`${tahun}-${bulan}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    // format manual YYYY-MM-DD (tanpa UTC)
    const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
    };

    const startDate = formatDate(start);
    const endDate = formatDate(end);



    try {
        const rows = await db.query(sql, [startDate, endDate, idk]);

        res.json({
            success: true,
            data: rows[0] || null
        });

    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }

};

//===============================
//simpan Nilai (update)
//===============================

const updateByKeys = async (table, data, where, db) => {
  // ambil field dari data
  const fields = Object.keys(data); //ambil nama fieldnya aja

    // bikin SET clause
  const setClause = fields
    .map((f, i) => `${f}=$${i + 1}`)
    .join(", ");

  // bikin WHERE clause
  const whereKeys = Object.keys(where);
  const whereClause = whereKeys
    .map((f, i) => `${f}=$${fields.length + i + 1}`)
    .join(" AND ");

  // gabung jadi SQL
  const sql = `
    UPDATE ${table}
    SET ${setClause}
    WHERE ${whereClause}
  `;

  // values untuk SET
  const values = fields.map(f => data[f] ?? null);

  // values untuk WHERE
  const whereValues = whereKeys.map(f => where[f]);

  const finalValues = [...values, ...whereValues];

  // debug (optional)
  //console.log(sql);
  //console.log(finalValues.length, "params");

  return db.query(sql, finalValues);
};


exports.simpanNilai = async (req, res) => {
  try {
    const d = req.body;

    const [xyear, xmonth] = d.period.split("-");
    const xperiode = `${xyear}-${String(xmonth).padStart(2, '0')}-01`;

    if (!d.period || !d.idk) {
      return res.json({ success: false, msg: "PERIOD & IDK wajib ada!" });
    }

    // ❗ penting: jangan ikutkan field WHERE ke data update
   
    const dataUpdate = { ...d };
    delete dataUpdate.period;
    delete dataUpdate.idk;

    await updateByKeys(
      "tabel_nilai",
      dataUpdate,
      { period: xperiode, idk: d.idk },
      db
    );

    res.json({ success: true, msg: "Update berhasil!" });

  } catch (e) {
    console.error(e);
    res.json({ success: false, msg: "Server error!" });
  }
};

//=====================================================================




exports.deleteNilai = async (req, res) => {
    try {
        const items = req.body.items;
        if (!items || items.length === 0) {
            return res.json({ success: false, msg: "Tidak ada data!" });
        }

        let successCount = 0;
        let failCount = 0;

        for (let row of items) {
          //console.log("Processing delete for:", row); // Debug: pastikan data yang diterima benar 
        
        //const d = new Date(row.period);
        //const zperiode = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        
          const zdate = row.period;
          const [zyear, zmonth]= zdate.split("-");
          const zperiode = `${zyear}-${String(zmonth).padStart(2, '0')}-01`;
        
          //const d = new Date(row.period);
          //const start = new Date(`${tahun}-${bulan}-01`);
          //const zperiode = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;


          console.log("Formatted period for deletion:", zperiode,row.idk,row.period); // Debug: pastikan format periode benar

            // di zperiode tidak dikasih tanda kutip
            const sql = `
                DELETE FROM tabel_nilai
                WHERE idk=$1 AND period=$2
            `;

            try {
                await db.query(sql, [row.idk, zperiode]);
                successCount++;
            } catch (err) {
                console.log("Delete error:", err);
                failCount++;
            }

        }

        return res.json({
            success: true,
            deleted: successCount,
            failed: failCount
        });

    } catch (err) {
        console.error(err);
        res.json({ success: false, msg: "Server error!" });
    }
};


//const pool = require('../db');

exports.tambahNilai = async (req, res) => {
  const period = req.body.period;

  if (!period) {
    return res.status(400).json({
      message: 'Period wajib diisi'
    });
  }
    const parts = period.split("-");

    if (parts.length !== 2) {
        return res.status(400).json({
        message: 'Format period harus YYYY-MM'
    });
    }

  const [zyear, zmonth]= period.split("-");
  const zperiode = `${zyear}-${String(zmonth).padStart(2, '0')}-01`;

  let client;
  //const client = await db.connect();

  try {
    client = await db.pool.connect();

    await client.query('BEGIN');

    // ✅ 1. Cek apakah period sudah ada
    const cek = await client.query(
      `SELECT 1 FROM tabel_nilai WHERE period = $1 LIMIT 1`,
      [zperiode]
    );

    if (cek.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'Period sudah ada, insert dibatalkan'
      });
    }

    // ✅ 2. Ambil parameter dari tabelref_nilai
    const refResult = await client.query(
      `SELECT * FROM tabelref_nilai LIMIT 1`
    );

    if (refResult.rowCount === 0) {
      throw new Error('Data referensi kosong');
    }

    const ref = refResult.rows[0];

    // ✅ 3. Insert dari tabel_karyawan
    await client.query(`
      INSERT INTO tabel_nilai (
        period, idk, nama, jabatan,
        nilaibonus,
        cutisakita,
        telatu30a,
        telatd30a,
        telatu60a,
        lupaa,
        hadirfulla,
        ontimea,
        ovrmnta,
        kerjalibura,
        rewarda,
        lalaia,
        tundaa,
        alphaa
      )
      SELECT 
        $1,
        k.idk,
        k.nama,
        k.jabatan,
        $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      FROM tabel_karyawan k
    `, [
      zperiode,
      ref.nilaibonus,
      ref.cutisakita,
      ref.telatu30a,
      ref.telatd30a,
      ref.telatu60a,
      ref.lupaa,
      ref.hadirfulla,
      ref.ontimea,
      ref.ovrmnta,
      ref.kerjalibura,
      ref.rewarda,
      ref.lalaia,
      ref.tundaa,
      ref.alphaa
    ]);

    await client.query('COMMIT');

    res.json({
      message: 'Data berhasil ditambahkan'
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error(err);

    res.status(500).json({
      message: 'Terjadi error',
      error: err.message
    });
  } finally {
    if (client) client.release();
  }
};