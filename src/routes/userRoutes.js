const express = require("express");
const router = express.Router();

// Controller handles tracking separate data storage instances
const { createUser, getUsers, updateUser, deleteUser } = require("../controllers/userController.js");

// Pure object validation gateway destructured handler
const authenticate = require("../middleware/auth.middleware"); 

// Create new user
router.post("/", authenticate, createUser);

// Get all users
router.get("/", authenticate, getUsers);

// Update user by ID
router.put("/:userId", authenticate, updateUser);

// Delete user by ID
router.delete("/:userId", authenticate, deleteUser);

module.exports = router;
