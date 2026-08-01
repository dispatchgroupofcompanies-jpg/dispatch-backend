const express = require("express");
const router = express.Router();

// Destructure cleanly from your controllers
const { 
  getDashboardStats 
} = require("../../controllers/admin/dashboard.controller.js");

const authMiddleware = require("../../middleware/auth.middleware.js");
const { requireAdmin } = require("../../middleware/authorize.middleware");

// All admin routes require authentication
router.use(authMiddleware, requireAdmin);

// Admin Dashboard Stats
router.get("/stats", getDashboardStats);

module.exports = router;
