// routes/sondageRoutes.js
const express = require("express");
const router = express.Router();
const sondageCtrl = require("../controllers/pollController");
const { auth } = require("../middleware/auth");

// ✅ routes spécifiques d'abord
router.get("/voted", auth, sondageCtrl.getVotedPolls);
router.get("/unvoted", auth, sondageCtrl.getUnvotedPolls);
router.get("/categories", sondageCtrl.getCategories);
router.post("/results", sondageCtrl.getPollResults);

// ✅ auto-finish : tu peux appeler en GET ou PUT depuis Postman
router.get("/auto-finish", sondageCtrl.autoFinishSondages);
router.put("/auto-finish", sondageCtrl.autoFinishSondages);

// ✅ options AVANT /:id_sondage (sinon collision)
router.get("/options/:id_sondage", sondageCtrl.getSondageWithOptions);

// ✅ dynamique à la fin
router.get("/:id_sondage", sondageCtrl.getSondageById);

module.exports = router;
