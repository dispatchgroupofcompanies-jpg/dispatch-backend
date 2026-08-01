const express = require("express");
const router = express.Router();

const {
  createInvoice,
  getInvoiceList,
  getInvoiceById,
  getInvoicePdfLink,
  updateInvoice,
  deleteInvoice,
  updateInvoiceStatus,
  downloadInvoicePDF
} = require("../../controllers/user/invoice.controller");

const authenticate = require("../../middleware/auth.middleware");
const { body } = require("express-validator");
const { validateRequest, validateObjectId } = require("../../middleware/validation.middleware");

// All user invoice routes require authentication
router.use(authenticate);

// User Invoice Operations
router.post(
  "/",
  body("payee").isObject().withMessage("Payee details are required."),
  body("payee").custom((payee) => Boolean(payee.companyName || payee.payeeSelectKey)).withMessage("A payee company is required."),
  body("trips").isArray({ min: 1, max: 200 }).withMessage("At least one trip is required."),
  body("trips.*.totalCharges").optional().isFloat({ min: 0 }).toFloat(),
  body("trips.*.dispatchPercentage").optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body("trips.*.dispatchPercent").optional().isFloat({ min: 0, max: 100 }).toFloat(),
  validateRequest,
  createInvoice
);
router.get("/", getInvoiceList);
router.get("/:invoiceId", validateObjectId("invoiceId"), getInvoiceById);
router.get("/:invoiceId/pdf-link", validateObjectId("invoiceId"), getInvoicePdfLink);
router.put("/:invoiceId", validateObjectId("invoiceId"), updateInvoice);
router.delete("/:invoiceId", validateObjectId("invoiceId"), deleteInvoice);
router.patch("/:invoiceId/status", validateObjectId("invoiceId"), body("invoiceStatus").isIn(["draft", "pending", "approved", "rejected", "paid", "cancelled"]), validateRequest, updateInvoiceStatus);
router.get("/:invoiceId/download", validateObjectId("invoiceId"), downloadInvoicePDF);

module.exports = router;
