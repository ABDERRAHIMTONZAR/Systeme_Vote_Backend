const express = require("express");
const router = express.Router();

const voteController = require("../controllers/voteController");
const { auth } = require("../middleware/auth");
router.post("/insert", auth, voteController.insertVote);


module.exports = router;