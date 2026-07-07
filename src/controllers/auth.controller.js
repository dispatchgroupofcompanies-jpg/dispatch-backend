const jwt = require("jsonwebtoken");
const Admin = require("../models/user.model"); 
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

    // 5. Generate JWT token
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