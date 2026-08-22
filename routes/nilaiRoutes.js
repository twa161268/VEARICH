//routes/nilaiRoutes.js

const express = require("express");
const router = express.Router();
const nilaiController = require("../controllers/nilaiController");
router.get("/load/:periode", nilaiController.loadDataByPeriode);
router.post("/delete", nilaiController.deleteNilai);

// endpoint untuk tombol btntambah
router.post('/tambah', nilaiController.tambahNilai);

module.exports = router;

