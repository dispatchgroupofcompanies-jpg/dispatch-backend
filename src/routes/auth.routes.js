const express = require("express");
const router = express.Router();
const { login, logout } = require("../controllers/auth.controller");
const { authLimiter } = require("../middleware/rateLimiter");
const { body } = require("express-validator");
const { validateRequest } = require("../middleware/validation.middleware");

// Public routes (no authentication required) - with strict rate limiting
router.post(
  "/login",
  authLimiter,
  body("email").isString().trim().notEmpty().withMessage("Email is required."),
  body("password").isString().isLength({ min: 1, max: 128 }).withMessage("Password is required."),
  validateRequest,
  login
);
router.post("/logout", authLimiter, logout);

module.exports = router;
