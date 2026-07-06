const express = require("express");
const router = express.Router();

const { resetAdminPassword, getAdminProfile } = require("../controllers/admin.controller");

// 🔥 ADMIN PASSWORD RESET ROUTE
router.post("/reset-password", resetAdminPassword);

// 🔥 GET ADMIN PROFILE ROUTE
router.get("/profile", getAdminProfile);

module.exports = router;