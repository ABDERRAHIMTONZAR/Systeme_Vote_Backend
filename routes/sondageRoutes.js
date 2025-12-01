const express = require("express");
const router = express.Router();
const sondageCtrl = require("../controllers/pollController");
const {auth} = require("../middleware/auth");

router.get("/voted",auth,sondageCtrl.getVotedPolls);
router.get("/unvoted",auth,sondageCtrl.getUnvotedPolls);
router.get("/result",sondageCtrl.getPollResults);
router.put("/auto-finish",sondageCtrl.autoFinishSondages);


module.exports = router;
   