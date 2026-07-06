const express = require("express");
const router = express.Router();

const { createUser, getUsers, updateUser, deleteUser } = require("../../controllers/userController.js");

const authenticate = require("../../middleware/auth.middleware");

// All admin user management routes require authentication
router.use(authenticate);

// Create new user
router.post("/", createUser);

// Get all users
router.get("/", getUsers);

// Update user by ID
router.put("/:userId", updateUser);

// Delete user by ID
router.delete("/:userId", deleteUser);

module.exports = router;