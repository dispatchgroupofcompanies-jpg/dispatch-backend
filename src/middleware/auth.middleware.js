const jwt = require("jsonwebtoken");
const User = require("../models/user.model"); 
const Admin = require("../models/admin.model");
const addUser = require("../models/addUsers.js");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const authMiddleware = async (req, res, next) => {
  try {
    // 1. Extract token from header
    const token = req.header("Authorization")?.replace("Bearer ", "");
    console.log("Extracted Token:", token); 

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // 2. Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 3. Determine if it's a User or an Admin (Checks decoded.id or decoded._id)
    const targetId = decoded.id || decoded._id || decoded.userId;
    
    if (!targetId) {
      return res.status(401).json({
        success: false,
        message: "Malformed token payload.",
      });
    }

    // First try to look up a regular User
    let account = await User.findById(targetId).select("-password");
    let accountType = "user";

    // If not found in User model, try old addUser model (for backward compatibility)
    if (!account) {
      account = await addUser.findById(targetId).select("-password");
    }

    // If still not found, try to look up an Admin
    if (!account) {
      account = await Admin.findById(targetId).select("-password");
      accountType = "admin";
    }

    // 4. Validate account status
    if (!account || account.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Authorization failed. Account is invalid or deactivated.",
      });
    }

    // 5. Attach the authenticated entity to the request object
    req.user = account;
    req.accountType = accountType; // Accessible in controllers if you need to enforce roles
    
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

module.exports = authMiddleware;