const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const multer = require("multer");

const {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  updateInvoiceStatus,
  updatePaymentStatus,
  downloadInvoicePDF,
  downloadPaidInvoicePDF,
} = require("../../controllers/admin/invoice.controller.js");

const authenticate = require("../../middleware/auth.middleware");
const { requireAdmin } = require("../../middleware/authorize.middleware");
const { validateRequest, validateObjectId } = require("../../middleware/validation.middleware");
const Invoice = require("../../models/invoice.model");
const mongoose = require("mongoose");

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

// All admin invoice routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// ==========================================
// Admin Invoice Management Routes
// ==========================================

// GET /api/admin/invoices - List all invoices
router.get("/", getAllInvoices);

// GET /api/admin/invoices/check-vrid - Check if VRID exists
router.get("/check-vrid", async (req, res) => {
  try {
    const { vrid, excludeInvoiceId } = req.query;

    if (!vrid || typeof vrid !== "string" || !vrid.trim()) {
      return res.status(400).json({
        success: false,
        message: "VRID parameter is required and must be a non-empty string",
      });
    }

    if (excludeInvoiceId && !mongoose.isValidObjectId(excludeInvoiceId)) {
      return res.status(400).json({ success: false, message: "Invalid invoice ID." });
    }

    const escapedVrid = vrid.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const vridRegex = new RegExp(`^${escapedVrid}$`, "i");
    const query = {
      "trips.vrid": vridRegex,
      ...(excludeInvoiceId ? { _id: { $ne: excludeInvoiceId } } : {}),
    };
    const existingInvoice = await Invoice.findOne(query).select("_id");

    return res.status(200).json({
      success: true,
      exists: Boolean(existingInvoice),
    });
  } catch (error) {
    console.error("Check VRID error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.get("/:id", validateObjectId("id"), getInvoiceById);

// POST /api/admin/invoices - Create invoice (Admin directly handles this now)
router.post(
  "/",
  body("payee").isObject().withMessage("Payee details are required."),
  body("payee")
    .custom((payee) => Boolean(payee.companyName || payee.payeeSelectKey))
    .withMessage("A payee company is required."),
  body("trips").isArray({ min: 1, max: 200 }).withMessage("At least one trip is required."),
  body("trips.*.totalCharges").optional().isFloat({ min: 0 }).toFloat(),
  body("trips.*.dispatchPercentage").optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body("trips.*.dispatchPercent").optional().isFloat({ min: 0, max: 100 }).toFloat(),
  validateRequest,
  createInvoice
);

// PUT /api/admin/invoices/:id - Update invoice details (Admin directly handles this now)
router.put(
  "/:id",
  body("payee").optional().isObject(),
  body("trips").optional().isArray({ min: 1, max: 200 }),
  validateRequest,
  validateObjectId("id"),
  updateInvoice
);

// DELETE /api/admin/invoices/:id - Delete invoice completely (Admin directly handles this now)
router.delete("/:id", validateObjectId("id"), deleteInvoice);

// GET /api/admin/invoices/:id/download - Download standard invoice PDF
router.get("/:id/download", validateObjectId("id"), downloadInvoicePDF);

// GET /api/admin/invoices/:id/download-paid - Download paid invoice PDF with payment proof page
router.get("/:id/download-paid", validateObjectId("id"), downloadPaidInvoicePDF);

// PATCH /api/admin/invoices/:id/status - Update invoice status (e.g. approve/reject)
router.patch("/:id/status", validateObjectId("id"), updateInvoiceStatus);

// PATCH /api/admin/invoices/:id/payment-status - Update payment status & upload proof
router.patch(
  "/:id/payment-status",
  validateObjectId("id"),
  paymentProofUpload.single("paymentProof"),
  updatePaymentStatus
);

module.exports = router;
