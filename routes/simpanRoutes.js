//routes/simpanRoutes.js
const express = require("express");
const router = express.Router();
const nilaiController = require("../controllers/nilaiController");

// Simpan data nilai
router.post("/", nilaiController.simpanNilai);

module.exports = router;