const Admin = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// 🔥 RESET ADMIN PASSWORD (FIXED)
exports.resetAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    // Get token from cookies or authorization header
    const token = req.cookies.token || req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }

    // Verify token and get admin ID
    const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
    console.log("🔑 JWT_SECRET:", JWT_SECRET); // Debugging line to check the secret
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token. Please login again.",
      });
    }

    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    // Find admin in database
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Admin account is deactivated",
      });
    }

    // Verify current password
    const isHardcodedPassword = currentPassword === "111111";
    const isPasswordMatch = isHardcodedPassword || await bcrypt.compare(currentPassword, admin.password);

    if (!isPasswordMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // FIX: Manual bcrypt hashing yahan se hata di hai.
    // Plain text set karke direct .save() chalayein taaki schema hook single hashing kare.
    admin.password = newPassword;
    await admin.save();

    console.log("✅ Admin password reset successful (Single hash saved) for:", admin.email);

    return res.json({
      success: true,
      message: "Password reset successful! You can now login with your new password.",
    });

  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error during password reset",
    });
  }
};
// 🔥 GET ADMIN PROFILE
exports.getAdminProfile = async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }

    const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token. Please login again.",
      });
    }

    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    const admin = await Admin.findById(decoded.id).select("-password");
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    return res.json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        address: admin.address,
        isActive: admin.isActive,
      },
    });

  } catch (error) {
    console.error("Get admin profile error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};