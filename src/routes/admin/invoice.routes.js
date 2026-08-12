const express = require("express");
const router = express.Router();

const {
  getAllInvoices,
  updateInvoiceStatus,
  rejectInvoice,
  updatePaymentStatus,
  downloadInvoicePDF,
  downloadPaidInvoicePDF,
} = require("../../controllers/admin/invoice.controller.js");

const authenticate = require("../../middleware/auth.middleware");
const { requireAdmin } = require("../../middleware/authorize.middleware");
const multer = require("multer");

// Payment proof images are kept in memory and streamed to Cloudinary.
const paymentProofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      return callback(new Error("Only JPG, PNG, and WebP images are allowed as payment proof"));
    }
    callback(null, true);
  },
});

// The listing controller safely scopes non-admin accounts to their own invoices.
// All administrative changes remain admin-only below.
router.use(authenticate);

// Compatibility read endpoint for existing user dashboards.
router.get("/", getAllInvoices);

// Admin Invoice Management
router.use(requireAdmin);
router.get("/:id/download", downloadInvoicePDF);
router.get("/:id/download-paid", downloadPaidInvoicePDF);
router.patch("/:id/status", updateInvoiceStatus);
router.patch("/:id/payment-status", paymentProofUpload.single("paymentProof"), updatePaymentStatus);
router.patch("/rejected/:id/status", rejectInvoice);

module.exports = router;
