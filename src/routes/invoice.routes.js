const express = require("express");
const router = express.Router();

const {
  createInvoice,
  getInvoiceList,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  updateInvoiceStatus
} = require("../controllers/invoice.controller");

const authenticate = require("../middleware/auth.middleware"); 

router.use(authenticate);

router.post("/", createInvoice);
router.get("/", getInvoiceList);
router.get("/:invoiceId", getInvoiceById);
router.put("/:invoiceId", updateInvoice);
router.delete("/:invoiceId", deleteInvoice);
router.patch("/:invoiceId/status", updateInvoiceStatus);

module.exports = router;