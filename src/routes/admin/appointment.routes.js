const express = require("express");
const router = express.Router();

const {
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  deleteAppointment,
  downloadAppointmentPDF,
} = require("../../controllers/admin/appointment.controller.js");

const authenticate = require("../../middleware/auth.middleware.js");
const { requireAdmin } = require("../../middleware/authorize.middleware");

// All admin appointment routes require authentication
router.use(authenticate, requireAdmin);

// Get all appointments
router.get("/", getAppointments);

// Get appointment by ID
router.get("/:id", getAppointmentById);

router.patch("/:appointmentId/status", updateAppointmentStatus);

// Delete appointment
router.delete("/:appointmentId", deleteAppointment);

// Download appointment PDF
router.get("/:id/download", downloadAppointmentPDF);

module.exports = router;
