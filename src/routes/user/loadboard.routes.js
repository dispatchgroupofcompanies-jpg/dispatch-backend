const express = require("express");
const router = express.Router();
const loadboardController = require("../../controllers/user/loadboard.controller");
const authMiddleware = require("../../middleware/auth.middleware");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      return callback(new Error("Only JPG, PNG, and WebP screenshots are allowed"));
    }
    callback(null, true);
  },
});

// All routes require authentication
router.use(authMiddleware);

// Get all load board records
router.get("/", loadboardController.getAllLoadBoardRecords);

// Search load board records
router.get("/search", loadboardController.searchLoadBoardRecords);

// Create new load board record
router.post("/", upload.single("screenshot"), loadboardController.createLoadBoardRecord);

// Update load board record
router.put("/:id", upload.single("screenshot"), loadboardController.updateLoadBoardRecord);

// Delete load board record
router.delete("/:id", loadboardController.deleteLoadBoardRecord);

module.exports = router;
