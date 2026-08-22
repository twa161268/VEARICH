// controllers/karyawanController.js
const db = require('../db');

exports.getByIdk = async (req, res) => {
  try {
    const { stkid } = req.params;

    const sql = `
      SELECT *
      FROM MASTER_STK
      WHERE STKID = '${stkid}';
    `;

    const rows = await db.query(sql);
    res.json(rows.length ? rows[0] : {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.loadDatabyidk = async (req, res) => {
  const stkid = req.params.stkid;

  const sql = `
    SELECT *
    FROM master_stk
    WHERE stkid = $1
`;

  try {
    const rows = await db.query(sql, [stkid]);

    res.json({
      success: true,
      data: rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
};

exports.loadDatak = async (req, res) => {
  const sql = `
    SELECT  stkid, namastk, username
    FROM master_stk
    ORDER BY namastk
    `;

  try {
    //const rows = await db.query(sql);
    const rows = await db.query(sql);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.json({ success: false });
  }
};

// READ
exports.getAll = async (req, res) => {
  const result = await db.query('SELECT * FROM master_stk ORDER BY stkid');
  res.render('stokist', { data: result.rows }); //render stokist disini maksudnya stokist.ejs
};

// CREATE
exports.create = async (req, res) => {
  try {
    const {
      stkid,
      namastk,
      username,
      alamat,
      telepon,
      wilayah,
      kota,
      tgljoin,
      grade,
      persentase,
      stktype,
    } = req.body;

    await db.query(
      'INSERT INTO master_stk (stkid, namastk, username,alamat,telepon,wilayah,kota, tgljoin,grade,persentase,stktype) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        stkid,
        namastk,
        username,
        alamat,
        telepon,
        wilayah,
        kota,
        tgljoin,
        grade,
        persentase,
        stktype,
      ]
    );

    //res.sendStatus(200);
    res.json({ success: true, msg: 'Insert berhasil!' });
  } catch (e) {
    console.error(e);
    res.json({ success: false, msg: 'Insert error!' });
  }
};

// UPDATE
exports.update = async (req, res) => {
  try {
    const d = req.body;

    if (!d.stkid) {
      return res.json({ success: false, msg: 'STKID wajib ada!' });
    }

    // ❗ penting: jangan ikutkan field WHERE ke data update

    const dataUpdate = { ...d };
    delete dataUpdate.stkid;

    await updateByKeys('master_stk', dataUpdate, { stkid: d.stkid }, db);

    res.json({ success: true, msg: 'Update berhasil!' });
  } catch (e) {
    console.error(e);
    res.json({ success: false, msg: 'Server error!' });
  }
};

const updateByKeys = async (table, data, where, db) => {
  // ambil field dari data
  const fields = Object.keys(data); //ambil nama fieldnya aja

  // bikin SET clause
  const setClause = fields.map((f, i) => `${f}=$${i + 1}`).join(', ');

  // bikin WHERE clause
  const whereKeys = Object.keys(where);
  const whereClause = whereKeys.map((f, i) => `${f}=$${fields.length + i + 1}`);

  // gabung jadi SQL
  const sql = `
    UPDATE ${table}
    SET ${setClause}
    WHERE ${whereClause}
  `;

  // values untuk SET
  const values = fields.map((f) => data[f] ?? null);

  // values untuk WHERE
  const whereValues = whereKeys.map((f) => where[f]);

  const finalValues = [...values, ...whereValues];

  // debug (optional)
  //console.log(sql);
  //console.log(finalValues.length, "params");

  return db.query(sql, finalValues);
};

/*
exports.remove = async (req, res) => {

    try {
        const items = req.body.items;

        if (!items || items.length === 0) {
            return res.json({ success: false, msg: "Tidak ada data!" });
        }

        const ids = items.map(i => i.idk); // jadi gak usah pake for loop kayak yang di controller nilai
        await db.query(
            `DELETE FROM tabel_karyawan WHERE idk = ANY($1)`,
            [ids]
        );

        return res.json({
            success: true,
            deleted: ids.length
        });

    } catch (err) {
        console.error(err);
        res.json({ success: false, msg: "Server error!" });
    }
};
*/

exports.remove = async (req, res) => {
  try {
    const items = req.body.items;
    if (!items || items.length === 0) {
      return res.json({ success: false, msg: 'Tidak ada data!' });
    }

    let successCount = 0;
    let failCount = 0;

    for (let row of items) {
      console.log('Formatted idk for deletion:', row.idk); // Debug: pastikan format periode benar

      // di zperiode tidak dikasih tanda kutip
      const sql = `
                DELETE FROM master_stk
                WHERE stkid=$1
            `;

      try {
        await db.query(sql, [row.stkid]);
        successCount++;
      } catch (err) {
        console.log('Delete error:', err);
        failCount++;
      }
    }

    return res.json({
      success: true,
      deleted: successCount,
      failed: failCount,
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, msg: 'Server error!' });
  }
};
