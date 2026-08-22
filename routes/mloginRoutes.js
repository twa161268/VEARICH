// routes/karyawanRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/mloginController");
const c = require("../controllers/mloginController");

router.get("/load", c.loadDatak);

router.post("/create", c.create);
router.post("/update", c.update);
router.post("/delete", c.remove);
router.get("/", c.getAll);
router.get("/load/:idk", c.loadDatabyidk);
//router.get("/:idk", ctrl.getByIdk);

module.exports = router;


