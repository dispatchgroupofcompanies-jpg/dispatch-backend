const express = require("express");
const router = express.Router();

const { getDashboardStats } = require("../../controllers/user/dashboard.controller");
const authenticate = require("../../middleware/auth.middleware");

// Protect all user dashboard routes
router.use(authenticate);

// User Dashboard Stats
router.get("/stats", getDashboardStats);

module.exports = router;
