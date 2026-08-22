//routes/nilaiidkRoutes.js
const express = require("express");
const router = express.Router();
const nc = require("../controllers/nilaiController");
router.get("/load/:periode/:idk", nc.loadDataByPeriodeidk);

module.exports = router;