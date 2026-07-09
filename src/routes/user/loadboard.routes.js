const express = require("express");
const router = express.Router();
const loadboardController = require("../../controllers/user/loadboard.controller");
const authMiddleware = require("../../middleware/auth.middleware");

// All routes require authentication
router.use(authMiddleware);

// Get all load board records
router.get("/", loadboardController.getAllLoadBoardRecords);

// Search load board records
router.get("/search", loadboardController.searchLoadBoardRecords);

// Create new load board record
router.post("/", loadboardController.createLoadBoardRecord);

// Update load board record
router.put("/:id", loadboardController.updateLoadBoardRecord);

// Delete load board record
router.delete("/:id", loadboardController.deleteLoadBoardRecord);

module.exports = router;
