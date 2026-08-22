//routes/reportRoutes.js
const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");

router.get("/pdf", reportController.generatePdf);
router.get("/pdf2", reportController.generatePdf2);

module.exports = router;