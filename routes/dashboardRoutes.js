const express = require("express");
const router = express.Router();
const { getDashboardStats } = require("../controllers/dashboardController");
const { getMonthlyStats } = require("../controllers/dashboardController");
const { getPollStatusDistribution } = require("../controllers/dashboardController");
const { getVoterEngagementDistribution } = require("../controllers/dashboardController");
const { createPoll } = require("../controllers/dashboardController");
const { getAllPolls } = require("../controllers/dashboardController");
const { updatePoll } = require("../controllers/dashboardController");
const { deletePoll } = require("../controllers/dashboardController");
const {auth} = require("../middleware/auth");

router.get("/stats", auth, getDashboardStats);
router.get("/monthly-stats",auth, getMonthlyStats);

router.get("/poll-status", auth,getPollStatusDistribution);
router.get("/engagement", auth, getVoterEngagementDistribution);
router.post("/create-poll", auth, createPoll);
router.get("/my-polls", auth, getAllPolls);
router.put("/update/:id", auth, updatePoll);
router.delete("/delete/:id", auth, deletePoll);

module.exports = router;
