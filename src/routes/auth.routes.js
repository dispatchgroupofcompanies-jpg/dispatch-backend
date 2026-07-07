const express = require("express");
const router = express.Router();
const { login, logout } = require("../controllers/auth.controller");
const { authLimiter } = require("../middleware/rateLimiter");

// Public routes (no authentication required) - with strict rate limiting
router.post("/login", authLimiter, login);
router.post("/logout", authLimiter, logout);

module.exports = router;
