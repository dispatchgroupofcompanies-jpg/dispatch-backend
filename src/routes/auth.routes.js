const express = require("express");
const router = express.Router();
const { login, logout, me } = require("../controllers/auth.controller");
const authenticate = require("../middleware/auth.middleware");
const { authLimiter } = require("../middleware/rateLimiter");
const { body } = require("express-validator");
const { validateRequest } = require("../middleware/validation.middleware");

router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

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
router.get("/me", authenticate, me);

module.exports = router;
