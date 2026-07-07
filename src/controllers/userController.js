const userService = require("../services/AdduserService.js");

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, address } = req.body;
    
    if (!name || !email || !password || !address) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields are required",
        received: { name: !!name, email: !!email, password: !!password, address: !!address }
      });
    }

    // Always set role as "user" when creating new user from admin panel
    const user = await userService.createUser({ name, email, password, address, role: "user" });
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user directories",
    });
  }
};

// Update user by ID
exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, password, address } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = password;
    if (address) updateData.address = address;

    const updatedUser = await userService.updateUser(userId, updateData);
    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update user",
    });
  }
};

// Delete user by ID
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const result = await userService.deleteUser(userId);
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to delete user",
    });
  }
};
