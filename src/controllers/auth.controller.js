const jwt = require("jsonwebtoken");
const Admin = require("../models/user.model"); 
const DeviceRequest = require("../models/DeviceRequest");
const bcrypt = require("bcryptjs");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // 2. Find account in Database
    const admin = await Admin.findOne({ email });
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 3. Check if account is active
    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // 4. Smart Password Verification Logic
    const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
    let isPasswordValid = false;

    // Check karo ki kya DB mein abhi bhi purana/default '111111' ka hash save hai
    const isDBStillDefault = await bcrypt.compare("111111", admin.password);

    console.log("--- LOGIN SECURITY LOGS ---");
    console.log(`Checking account: ${email}`);

    if (isDBStillDefault) {
      console.log("⚠️ Account is using default setup. Allowing '111111' fallback.");
      // Agar database mein default setup hai, toh '111111' string allow hogi
      if (password === "111111") {
        isPasswordValid = true;
      }
    } else {
      console.log("🔒 Admin has already changed the password. Hardcoded '111111' is now DISABLED.");
      // Ek baar admin ke password reset karne ke baad, sirf naya hashed password hi match hoga
      isPasswordValid = await bcrypt.compare(password, admin.password);
    }
    console.log("----------------------------");

    // Verification fail check
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 5. Device Approval Check (Skip for admin users)
    const deviceId = req.body.deviceId;
    const userAgent = req.body.userAgent || req.headers["user-agent"];
    
    // Get client IP (respecting trust proxy setup)
    const clientIp = req.ip || req.connection.remoteAddress;

    let deviceStatus = "approved"; // Default for backward compatibility

    // Skip device approval for admin users
    if (admin.role !== "admin") {
      // For non-admin users, deviceId is required
      if (!deviceId || typeof deviceId !== "string" || deviceId.trim().length === 0) {
        console.log(`[DEVICE LOGIN] ❌ No device ID provided for user ${email}`);
        console.log(`[DEVICE LOGIN] Request body:`, JSON.stringify(req.body, null, 2));
        return res.status(200).json({
          success: false,
          status: "device_id_required",
          message: "Please generate your device ID first. Click 'Generate Device ID' button on the login page.",
        });
      }

      const trimmedDeviceId = deviceId.trim();
      
      console.log(`[DEVICE LOGIN] Checking device in database for user ${email}`);
      console.log(`[DEVICE LOGIN] User ID: ${admin._id}`);
      console.log(`[DEVICE LOGIN] Device ID: ${trimmedDeviceId}`);

      // Find existing device request
      let deviceRequest = await DeviceRequest.findOne({
        userId: admin._id,
        deviceId: trimmedDeviceId,
      });
      
      console.log(`[DEVICE LOGIN] Device request found:`, deviceRequest ? `YES (Status: ${deviceRequest.status})` : "NO - Creating new request");

      if (!deviceRequest) {
        // New device - create pending request
        deviceRequest = await DeviceRequest.create({
          userId: admin._id,
          deviceId: trimmedDeviceId,
          userAgent: userAgent,
          ip: clientIp,
          status: "pending",
          requestedAt: new Date(),
        });
        deviceStatus = "pending_approval";
        console.log(`[DEVICE LOGIN] New device detected for user ${email}. Device ID: ${trimmedDeviceId.substring(0, 20)}... Status: pending`);
      } else {
        // Existing device - check status
        if (deviceRequest.status === "pending") {
          deviceStatus = "pending_approval";
          console.log(`[DEVICE LOGIN] Device pending approval for user ${email}. Device ID: ${trimmedDeviceId.substring(0, 20)}...`);
        } else if (deviceRequest.status === "rejected") {
          deviceStatus = "access_denied";
          console.log(`[DEVICE LOGIN] Access denied for user ${email}. Device ID: ${trimmedDeviceId.substring(0, 20)}... Status: rejected`);
        } else if (deviceRequest.status === "approved") {
          // Device is approved - verify it matches the current device
          deviceStatus = "approved";
          
          // Check if the device ID in database matches the one being used for login
          if (deviceRequest.deviceId === trimmedDeviceId) {
            // Device ID matches - update last seen info
            deviceRequest.lastSeenAt = new Date();
            if (clientIp) deviceRequest.ip = clientIp;
            if (userAgent) deviceRequest.userAgent = userAgent;
            await deviceRequest.save();
            console.log(`[DEVICE LOGIN] Approved device login for user ${email}. Device ID: ${trimmedDeviceId.substring(0, 20)}...`);
          } else {
            // Device ID doesn't match - deny access
            deviceStatus = "device_id_mismatch";
            console.log(`[DEVICE LOGIN] Device ID mismatch for user ${email}. Expected: ${deviceRequest.deviceId.substring(0, 20)}..., Got: ${trimmedDeviceId.substring(0, 20)}...`);
          }
        }
      }
    } else {
      console.log(`[DEVICE LOGIN] Admin user login (bypassing device check). User: ${email}`);
    }

    // If device is not approved, deny access (only for non-admin users)
    if (deviceStatus === "pending_approval" && admin.role !== "admin") {
      return res.status(200).json({
        success: false,
        status: "pending_approval",
        message: "Please wait for admin approval.",
      });
    }

    if (deviceStatus === "access_denied" && admin.role !== "admin") {
      return res.status(200).json({
        success: false,
        status: "access_denied",
        message: "This device was denied access. Contact admin.",
      });
    }

    if (deviceStatus === "device_id_mismatch" && admin.role !== "admin") {
      return res.status(200).json({
        success: false,
        status: "device_id_mismatch",
        message: "Device ID not matched. You can only login from the approved device.",
      });
    }

    // 6. Generate JWT token
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 6. Set httpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax",
    });

    // 7. Success Response Data Structure
    const responseData = {
      success: true,
      message: "Login successful",
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        address: admin.address,
        isActive: admin.isActive,
      },
    };

    // Backward compatibility for Admin panels
    if (admin.role === "admin") {
      responseData.admin = responseData.user;
    }

    return res.json(responseData);
    
  } catch (error) {
    console.error("❌ LOGIN CRITICAL ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error during login",
    });
  }
};

// 🔥 LOGOUT
exports.logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error during logout",
    });
  }
};