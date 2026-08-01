const express = require("express");
const router = express.Router();

const {
  getAllInvoices,
  updateInvoiceStatus,
  rejectInvoice,
  downloadInvoicePDF
} = require("../../controllers/admin/invoice.controller.js");

const authenticate = require("../../middleware/auth.middleware");
const { requireAdmin } = require("../../middleware/authorize.middleware");

// The listing controller safely scopes non-admin accounts to their own invoices.
// All administrative changes remain admin-only below.
router.use(authenticate);

// Compatibility read endpoint for existing user dashboards.
router.get("/", getAllInvoices);

// Admin Invoice Management
router.use(requireAdmin);
router.get("/:id/download", downloadInvoicePDF);
router.patch("/:id/status", updateInvoiceStatus);
router.patch("/rejected/:id/status", rejectInvoice);

module.exports = router;
