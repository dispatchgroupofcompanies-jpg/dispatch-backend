const express = require("express");
const router = express.Router();

const {
  createInvoice,
  getInvoiceList,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  updateInvoiceStatus,
  downloadInvoicePDF
} = require("../../controllers/user/invoice.controller");

const authenticate = require("../../middleware/auth.middleware");

// All user invoice routes require authentication
router.use(authenticate);

// User Invoice Operations
router.post("/", createInvoice);
router.get("/", getInvoiceList);
router.get("/:invoiceId", getInvoiceById);
router.put("/:invoiceId", updateInvoice);
router.delete("/:invoiceId", deleteInvoice);
router.patch("/:invoiceId/status", updateInvoiceStatus);
router.get("/:invoiceId/download", downloadInvoicePDF);

module.exports = router;
