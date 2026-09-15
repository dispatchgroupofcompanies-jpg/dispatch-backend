const express = require("express");
const router = express.Router();

const authenticate = require("../../middleware/auth.middleware");
const { requireAdmin } = require("../../middleware/authorize.middleware");
const { listLoadboardRecords, updateLoadboardStatus } = require("../../controllers/admin/loadboard.controller");

// All admin loadboard routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/loadboard - list all 3P dispatch (loadboard) records for admin
router.get("/", listLoadboardRecords);

// PATCH /api/admin/loadboard/:id/status - update invoice or payment status
router.patch("/:id/status", updateLoadboardStatus);

module.exports = router;
