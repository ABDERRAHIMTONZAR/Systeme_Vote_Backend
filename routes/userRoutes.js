const express = require("express");
const router = express.Router();
const { updateUser, getUserById } = require("../controllers/userController");
const { auth } = require("../middleware/auth");

router.get("/", auth, getUserById);
router.put("/update", auth, updateUser);

module.exports = router;
