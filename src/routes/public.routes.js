const express = require("express");
const axios = require("axios");
const Invoice = require("../models/invoice.model");
const generateInvoicePDF = require("../services/pdf.service");

const router = express.Router();

const getSharedInvoice = (shareToken) => Invoice.findOne({
  shareToken,
  $or: [{ shareExpiresAt: null }, { shareExpiresAt: { $gt: new Date() } }],
});

// Legacy database-ID links deliberately reveal no invoice data.
router.get("/invoice/:invoiceId", (req, res) => {
  return res.status(404).json({ success: false, message: "Invoice not found." });
});

// A random, revocable token is required to access a shared PDF.
router.get("/public/invoices/:shareToken/pdf", async (req, res, next) => {
  try {
    const invoice = await getSharedInvoice(req.params.shareToken);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Shared invoice not found or expired." });
    }

    if (!invoice.pdfUrl) {
      invoice.pdfUrl = await generateInvoicePDF(invoice);
      await invoice.save();
    }

    const pdfResponse = await axios.get(invoice.pdfUrl, { responseType: "stream", timeout: 30000 });
    const fileName = `invoice-${invoice.invoiceNumber}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    pdfResponse.data.pipe(res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
