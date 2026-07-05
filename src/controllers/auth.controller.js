const User = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = User;

// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Please provide email and password" 
      });
    }

    const formattedEmail = email.toLowerCase();
    const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

   // 🔥 HARDCODED ADMIN BYPASS INSIDE USER LOGIN
    if (formattedEmail === "testing121@gmail.com" && password === "111111") {
      console.log("⚡ Hardcoded Admin Login Detected via Login Route!");

      // 1. Database se check karein agar is email ka admin sach mein maujood hai
      let adminInstance = await Admin.findOne({ email: formattedEmail });

      // 2. Agar database mein testing admin nahi hai, toh use pehle khud hi dhoondhein ya normal dynamic check lagayein
      // Agar dhoondhne par admin mil jaye toh uski REAL ID use karein, nahi toh fallback id lagayein
      const finalAdminId = adminInstance ? adminInstance._id : "65f1a2b3c4d5e6f7a8b9c0d1";

      const token = jwt.sign(
        { id: finalAdminId, role: "admin" }, // 👈 Dynamic Ya Real database wali ID lagayi
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };

      res.cookie('token', token, cookieOptions);
      return res.json({
        success: true,
        message: "Admin Login successful!",
        token,
        user: {
          id: finalAdminId, 
          name: adminInstance ? adminInstance.name : "System Admin",
          email: formattedEmail,
          role: "admin"
        }
      });
    }

    // ---------------------------------------------------------
    // BAKI REGULAR USERS KE LIYE NORMAL LOGIN FLOW
    // ---------------------------------------------------------
    const user = await User.findOne({ email: formattedEmail });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found. Please create an account first." 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    // Normal users ke liye role default to 'user'
    const userRole = user.role || "user";

    const token = jwt.sign(
      { id: user._id, role: userRole },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie('token', token, cookieOptions);
    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: userRole // Returns 'user'
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ 
      success: false,
      message: error.message || "Server error during login" 
    });
  }
};

// LOGOUT - clear auth cookie
exports.logout = async (req, res) => {
  try {
    res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};