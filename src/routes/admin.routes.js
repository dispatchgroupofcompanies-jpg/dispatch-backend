const express = require("express");
const router = express.Router();
const { 
  getadminDashboard,
  getAllInvoices,
  updateInvoiceStatus,
  rejectInvoice,
  getAllApointments
} = require("../controllers/admin.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.get("/stats", authMiddleware, getadminDashboard);

router.get("/invoices", authMiddleware, getAllInvoices);
router.patch("/approved/:id/status", authMiddleware, updateInvoiceStatus);
router.patch("/rejected/:id/status", authMiddleware, rejectInvoice); 
router.get("/all-appointments", authMiddleware, getAllApointments); 

module.exports = router;