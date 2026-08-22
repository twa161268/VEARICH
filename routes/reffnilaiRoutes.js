// routes/refnilaiRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/reffnilaiController");

router.get("/get", ctrl.get);
router.post("/update", ctrl.update);

module.exports = router;