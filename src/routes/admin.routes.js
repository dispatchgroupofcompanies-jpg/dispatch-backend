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

// 🔥 DEBUG: Check current user's auth status
router.get("/auth-check", (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "User is authenticated and authorized as admin",
      user: {
        id: req.user?._id,
        name: req.user?.name,
        email: req.user?.email,
        role: req.user?.role,
      },
      accountType: req.accountType,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error checking auth status",
      error: error.message,
    });
  }
});

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
