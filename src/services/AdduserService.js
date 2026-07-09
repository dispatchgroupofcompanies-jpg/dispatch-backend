const User = require("../models/user.model.js");

class UserService {
  // Create a new user record
  async createUser(userData) {
    const existingUser = await User.findOne({ email: userData.email }).lean();
    if (existingUser) {
      throw new Error("A user with this email already exists");
    }
    const newUser = new User(userData);
    const savedUser = await newUser.save();
    
    // Convert to plain object and strip password for security
    const userObj = savedUser.toObject();
    delete userObj.password;
    return userObj;
  }

  // Get all users optimized with Lean indexing
  async getAllUsers() {
    return await User.find({})
      .select("-password") // Do not return passwords
      .sort({ createdAt: -1 })
      .lean(); // Bypasses Hydration for optimal read performance
  }

  // Update user by ID
  async updateUser(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if email is being changed and if it already exists
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findOne({ email: updateData.email }).lean();
      if (existingUser) {
        throw new Error("A user with this email already exists");
      }
    }

    // Update fields
    Object.assign(user, updateData);
    const updatedUser = await user.save();
    
    // Convert to plain object and strip password
    const userObj = updatedUser.toObject();
    delete userObj.password;
    return userObj;
  }

  // Delete user by ID
  async deleteUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Prevent deletion of admin users
    if (user.role === 'admin') {
      throw new Error("Cannot delete admin users. Admin accounts are protected.");
    }
    
    await User.findByIdAndDelete(userId);
    return { message: "User deleted successfully" };
  }
}

module.exports = new UserService();
