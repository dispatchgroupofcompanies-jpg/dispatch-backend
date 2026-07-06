const express = require("express");
const router = express.Router();

// Destructure cleanly from your controllers
const { 
  getDashboardStats 
} = require("../../controllers/admin/dashboard.controller.js");

const authMiddleware = require("../../middleware/auth.middleware.js");

// All admin routes require authentication
router.use(authMiddleware);

// Admin Dashboard Stats
router.get("/stats", getDashboardStats);

module.exports = router;
