const express = require("express");
const router = express.Router();

const {
  getAllInvoices,
  updateInvoiceStatus,
  rejectInvoice
} = require("../../controllers/admin/invoice.controller.js");

const authenticate = require("../../middleware/auth.middleware");

// All admin invoice routes require authentication
router.use(authenticate);

// Admin Invoice Management
router.get("/", getAllInvoices);
router.patch("/:id/status", updateInvoiceStatus);
router.patch("/rejected/:id/status", rejectInvoice);

module.exports = router;
