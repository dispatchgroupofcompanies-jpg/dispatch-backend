const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth.middleware");

const { getProfile, saveProfile, clearProfile } = require("../controllers/companyController");

// All routes require authentication
router.use(authenticate);

router.get("/company-profile", getProfile);
router.post("/company-profile", saveProfile);
router.delete("/company-profile", clearProfile);

module.exports = router;
