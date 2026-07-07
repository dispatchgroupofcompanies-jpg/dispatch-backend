const express = require("express");
const router = express.Router();
const Invoice = require("../models/invoice.model");

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

module.exports = router;