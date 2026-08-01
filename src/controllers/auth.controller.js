const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const DeviceRequest = require("../models/DeviceRequest");
const bcrypt = require("bcryptjs");
const { getJwtSecret } = require("../config/env");

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

exports.login = async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Please provide email and password." });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (user.role !== "admin") {
      if (!deviceId || typeof deviceId !== "string" || !deviceId.trim()) {
        return res.status(400).json({ success: false, status: "device_id_required", message: "A device ID is required." });
      }

      const normalizedDeviceId = deviceId.trim();
      let request = await DeviceRequest.findOne({ userId: user._id, deviceId: normalizedDeviceId });
      if (!request) {
        request = await DeviceRequest.create({
          userId: user._id,
          deviceId: normalizedDeviceId,
          userAgent: req.get("user-agent"),
          status: "pending",
        });
      }

      if (request.status !== "approved") {
        const status = request.status === "rejected" ? "access_denied" : "pending_approval";
        return res.status(403).json({ success: false, status, message: "This device is not approved." });
      }

      request.lastSeenAt = new Date();
      request.userAgent = req.get("user-agent");
      await request.save();
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );
    res.cookie("token", token, cookieOptions);

    const account = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      address: user.address,
      isActive: user.isActive,
    };
    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: account,
      ...(user.role === "admin" ? { admin: account } : {}),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Unable to complete login." });
  }
};

exports.logout = (req, res) => {
  res.clearCookie("token", cookieOptions);
  return res.json({ success: true, message: "Logout successful." });
};
