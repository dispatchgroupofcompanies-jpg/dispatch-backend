const express = require("express");
const router = express.Router();

const authenticate = require("../../middleware/auth.middleware");
const { requireAdmin } = require("../../middleware/authorize.middleware");
const LoadBoard = require("../../models/loadboard.model");

// All admin loadboard routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/loadboard - list all 3P dispatch (loadboard) records for admin
router.get("/", async (req, res) => {
  try {
    // Allow optional query params: limit, page, search
    const { page = 1, limit = 200, search } = req.query;
    const skip = Math.max(0, (Number(page) - 1) * Number(limit));

    const filter = {};
    if (search && typeof search === "string") {
      const q = search.trim();
      const regex = new RegExp(q, "i");
      filter.$or = [
        { vrid: regex },
        { load1Id: regex },
        { load2Id: regex },
        { carrierName: regex },
        { thirdPartyCarrierName: regex },
        { dispatcher: regex },
        { driverName: regex },
      ];
    }

    const query = LoadBoard.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("createdBy", "email name");

    const [records, total] = await Promise.all([query.lean(), LoadBoard.countDocuments(filter)]);

    return res.status(200).json({ success: true, count: records.length, total, data: records });
  } catch (error) {
    console.error("Admin loadboard list error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
});

// PATCH /api/admin/loadboard/:id/status - update invoice or payment status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { invoiceStatus, paymentStatus } = req.body;

    // Validate input
    if (!invoiceStatus && !paymentStatus) {
      return res.status(400).json({
        success: false,
        message: "Either invoiceStatus or paymentStatus must be provided",
      });
    }

    // Allowed values
    const validInvoiceStatuses = ["generated", "pending"];
    const validPaymentStatuses = ["paid", "pending"];

    if (invoiceStatus && !validInvoiceStatuses.includes(invoiceStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid invoiceStatus. Must be one of: ${validInvoiceStatuses.join(", ")}`,
      });
    }

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid paymentStatus. Must be one of: ${validPaymentStatuses.join(", ")}`,
      });
    }

    const updateData = {};
    if (invoiceStatus) updateData.invoiceStatus = invoiceStatus;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;

    const record = await LoadBoard.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
      runValidators: true,
    }).lean();

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Load board record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: record,
    });
  } catch (error) {
    console.error("Admin loadboard status update error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
