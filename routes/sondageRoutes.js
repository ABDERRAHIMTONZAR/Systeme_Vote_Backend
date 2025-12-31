const express = require("express");
const router = express.Router();
const sondageCtrl = require("../controllers/pollController");
const { auth } = require("../middleware/auth");

router.get("/voted", auth, sondageCtrl.getVotedPolls);
router.get("/unvoted", auth, sondageCtrl.getUnvotedPolls);
router.get("/categories", sondageCtrl.getCategories);
router.post("/results", sondageCtrl.getPollResults);

router.get("/auto-finish", sondageCtrl.autoFinishSondages);
router.put("/auto-finish", sondageCtrl.autoFinishSondages);

router.get("/options/:id_sondage", sondageCtrl.getSondageWithOptions);

router.get("/:id_sondage", sondageCtrl.getSondageById);

module.exports = router;
