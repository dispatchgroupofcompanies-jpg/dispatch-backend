const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth.middleware");
const { requireAdmin } = require("../middleware/authorize.middleware");

const { resetAdminPassword, getAdminProfile } = require("../controllers/admin.controller");
const {
  getAllDeviceRequests,
  getPendingDeviceRequests,
  getUserDeviceHistory,
  approveDeviceRequest,
  rejectDeviceRequest,
  revokeDeviceRequest,
  getDeviceRequestStats,
} = require("../controllers/admin/deviceRequest.controller");

router.use(authenticate, requireAdmin);

// 🔥 ADMIN PASSWORD RESET ROUTE
router.post("/reset-password", resetAdminPassword);

// 🔥 GET ADMIN PROFILE ROUTE
router.get("/profile", getAdminProfile);

// 🔥 DEVICE REQUEST MANAGEMENT ROUTES
router.get("/device-requests", getAllDeviceRequests);
router.get("/device-requests/pending", getPendingDeviceRequests);
router.get("/device-requests/user/:userId", getUserDeviceHistory);
router.post("/device-requests/:id/approve", approveDeviceRequest);
router.post("/device-requests/:id/reject", rejectDeviceRequest);
router.post("/device-requests/:id/revoke", revokeDeviceRequest);
router.get("/device-requests/stats", getDeviceRequestStats);

module.exports = router;
