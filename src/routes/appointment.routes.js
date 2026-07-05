const express = require("express");
const router = express.Router();
const Appointment = require("../models/appointment.model");
const {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  deleteAppointment,
  downloadAppointmentPDF,
} = require("../controllers/appointment.controller");
const authenticate = require("../middleware/auth.middleware");

// All routes require authentication
router.use(authenticate);

// Create new appointment
router.post("/", createAppointment);

// Get all appointments
router.get("/", getAppointments);

// Get appointment by ID
router.get("/:id", getAppointmentById);

router.patch("/:appointmentId/status", updateAppointmentStatus);
// Delete appointment
router.delete("/:appointmentId", deleteAppointment);

// Update appointment
router.put("/:id", async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found." });
    }
    return res.json({ success: true, message: "Appointment updated successfully!", data: appointment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Download appointment PDF
router.get("/:id/download", downloadAppointmentPDF);


module.exports = router;
