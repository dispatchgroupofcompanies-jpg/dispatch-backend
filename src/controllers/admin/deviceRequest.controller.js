const DeviceRequest = require("../../models/DeviceRequest");
const User = require("../../models/user.model");
const Admin = require("../../models/admin.model");

// Get all device requests with optional status filter
exports.getAllDeviceRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status = "" } = req.query;

    // Build query
    const query = {};

    // Filter by status if provided
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query.status = status;
    }

    // If search term provided, search by user email or name
    if (search) {
      const users = await User.find({
        $or: [
          { email: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      query.userId = { $in: users.map((u) => u._id) };
    }

    const deviceRequests = await DeviceRequest.find(query)
      .populate("userId", "name email role")
      .sort({ requestedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DeviceRequest.countDocuments(query);

    return res.json({
      success: true,
      deviceRequests,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching device requests:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch device requests",
    });
  }
};

// Get all pending device requests
exports.getPendingDeviceRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    // Build query
    const query = { status: "pending" };

    // If search term provided, search by user email or name
    if (search) {
      const users = await User.find({
        $or: [
          { email: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      query.userId = { $in: users.map((u) => u._id) };
    }

    const deviceRequests = await DeviceRequest.find(query)
      .populate("userId", "name email role")
      .sort({ requestedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DeviceRequest.countDocuments(query);

    return res.json({
      success: true,
      deviceRequests,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching pending device requests:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch pending device requests",
    });
  }
};

// Get all device requests for a specific user
exports.getUserDeviceHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const deviceRequests = await DeviceRequest.find({ userId })
      .sort({ requestedAt: -1 });

    return res.json({
      success: true,
      deviceRequests,
    });
  } catch (error) {
    console.error("Error fetching user device history:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user device history",
    });
  }
};

// Approve a device request
exports.approveDeviceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?._id || req.user?.id;

    const deviceRequest = await DeviceRequest.findById(id);

    if (!deviceRequest) {
      return res.status(404).json({
        success: false,
        message: "Device request not found",
      });
    }

    if (deviceRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Device request is already ${deviceRequest.status}`,
      });
    }

    deviceRequest.status = "approved";
    deviceRequest.decidedAt = new Date();
    deviceRequest.decidedBy = adminId;
    await deviceRequest.save();

    // Populate user data for response
    await deviceRequest.populate("userId", "name email role");

    // Log the approval action
    console.log(`[DEVICE APPROVAL] Device ${deviceRequest.deviceId} approved for user ${deviceRequest.userId.email} by admin ${adminId} at ${new Date().toISOString()}`);

    return res.json({
      success: true,
      message: "Device request approved successfully",
      deviceRequest,
    });
  } catch (error) {
    console.error("Error approving device request:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to approve device request",
    });
  }
};

// Reject a device request
exports.rejectDeviceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?._id || req.user?.id;

    const deviceRequest = await DeviceRequest.findById(id);

    if (!deviceRequest) {
      return res.status(404).json({
        success: false,
        message: "Device request not found",
      });
    }

    if (deviceRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Device request is already ${deviceRequest.status}`,
      });
    }

    deviceRequest.status = "rejected";
    deviceRequest.decidedAt = new Date();
    deviceRequest.decidedBy = adminId;
    await deviceRequest.save();

    // Log the rejection action
    console.log(`[DEVICE REJECTION] Device ${deviceRequest.deviceId} rejected for user ${deviceRequest.userId.email} by admin ${adminId} at ${new Date().toISOString()}`);

    return res.json({
      success: true,
      message: "Device request rejected successfully",
    });
  } catch (error) {
    console.error("Error rejecting device request:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reject device request",
    });
  }
};

// Revoke an approved device request (set back to rejected)
exports.revokeDeviceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?._id || req.user?.id;

    const deviceRequest = await DeviceRequest.findById(id);

    if (!deviceRequest) {
      return res.status(404).json({
        success: false,
        message: "Device request not found",
      });
    }

    if (deviceRequest.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: `Cannot revoke device request with status: ${deviceRequest.status}`,
      });
    }

    deviceRequest.status = "rejected";
    deviceRequest.decidedAt = new Date();
    deviceRequest.decidedBy = adminId;
    await deviceRequest.save();

    // Log the revocation action
    console.log(`[DEVICE REVOCATION] Device ${deviceRequest.deviceId} revoked for user ${deviceRequest.userId.email} by admin ${adminId} at ${new Date().toISOString()}`);

    return res.json({
      success: true,
      message: "Device access revoked successfully",
    });
  } catch (error) {
    console.error("Error revoking device request:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to revoke device request",
    });
  }
};

// Get device request statistics
exports.getDeviceRequestStats = async (req, res) => {
  try {
    const total = await DeviceRequest.countDocuments();
    const pending = await DeviceRequest.countDocuments({ status: "pending" });
    const approved = await DeviceRequest.countDocuments({ status: "approved" });
    const rejected = await DeviceRequest.countDocuments({ status: "rejected" });

    // Get recent pending requests (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentPending = await DeviceRequest.countDocuments({
      status: "pending",
      requestedAt: { $gte: sevenDaysAgo },
    });

    return res.json({
      success: true,
      stats: {
        total,
        pending,
        approved,
        rejected,
        recentPending,
      },
    });
  } catch (error) {
    console.error("Error fetching device request stats:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch device request statistics",
    });
  }
};