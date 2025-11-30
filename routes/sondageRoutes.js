const express = require("express");
const router = express.Router();
const sondageCtrl = require("../controllers/pollController");
const auth = require("../middleware/auth");

router.get("/voted", sondageCtrl.getVotedPolls);
router.get("/unvoted", sondageCtrl.getUnvotedPolls);

module.exports = router;
