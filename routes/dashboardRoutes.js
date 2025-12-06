const express = require("express");
const router = express.Router();
const { getDashboardStats } = require("../controllers/dashboardController");
const { getMonthlyStats } = require("../controllers/dashboardController");
const { getPollStatusDistribution } = require("../controllers/dashboardController");
const { getVoterEngagementDistribution } = require("../controllers/dashboardController");
const {auth} = require("../middleware/auth");

router.get("/stats", auth, getDashboardStats);
router.get("/monthly-stats",auth, getMonthlyStats);

router.get("/poll-status", auth,getPollStatusDistribution);
router.get("/engagement", auth, getVoterEngagementDistribution);

module.exports = router;
