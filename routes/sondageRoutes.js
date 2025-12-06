const express = require("express");
const router = express.Router();
const sondageCtrl = require("../controllers/pollController");
const {auth} = require("../middleware/auth");

router.get("/voted",auth,sondageCtrl.getVotedPolls);
router.get("/unvoted",auth,sondageCtrl.getUnvotedPolls);
router.get("/categories", sondageCtrl.getCategories);
router.get("/unvoted?categorie=Développement",auth,sondageCtrl.getUnvotedPolls);
router.post("/results",sondageCtrl.getPollResults);
router.put("/auto-finish",sondageCtrl.autoFinishSondages);
router.get("/:id_sondage", sondageCtrl.getSondageById);
router.get("/options/:id_sondage", sondageCtrl.getSondageWithOptions);

module.exports = router;
