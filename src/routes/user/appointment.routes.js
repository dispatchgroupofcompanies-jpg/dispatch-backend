const express = require("express");
const router = express.Router();

const {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  downloadAppointmentPDF,
} = require("../../controllers/user/appointment.controller.js");

const authenticate = require("../../middleware/auth.middleware");

// All user appointment routes require authentication
router.use(authenticate);

// Create new appointment
router.post("/", createAppointment);

// Get all appointments
router.get("/", getAppointments);

// Get appointment by ID
router.get("/:id", getAppointmentById);

// Update appointment
router.put("/:id", updateAppointment);

router.patch("/:appointmentId/status", updateAppointmentStatus);

// Delete appointment
router.delete("/:appointmentId", deleteAppointment);

// Download appointment PDF
router.get("/:id/download", downloadAppointmentPDF);

module.exports = router;
