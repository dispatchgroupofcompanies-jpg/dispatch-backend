const express = require("express");
const router = express.Router();
const Invoice = require("../models/invoice.model");
const axios = require("axios");
const generateInvoicePDF = require("../services/pdf.service");

// Public route to view invoice by ID (no authentication required)
router.get("/invoice/:invoiceId", async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    const invoice = await Invoice.findById(invoiceId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error("Error fetching public invoice:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching invoice",
    });
  }
});

// Public PDF link used when an invoice is shared externally (for example,
// through WhatsApp). It forces a reliable PDF content type and filename.
router.get("/public/invoice/:invoiceId/pdf", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    if (!invoice.pdfUrl) {
      invoice.pdfUrl = await generateInvoicePDF(invoice);
      await invoice.save();
    }

    const pdfResponse = await axios.get(invoice.pdfUrl, {
      responseType: "stream",
    });
    const fileName = `invoice-${invoice._id}-${invoice.payeeSerialNumber || invoice.invoiceNumber}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Transfer-Encoding", "binary");
    pdfResponse.data.pipe(res);
  } catch (error) {
    console.error("Error serving public invoice PDF:", error.message);
    return res.status(502).json({
      success: false,
      message: "Invoice PDF is temporarily unavailable.",
    });
  }
});

module.exports = router;
