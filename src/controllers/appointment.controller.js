const mongoose = require("mongoose");
const Appointment = require("../models/appointment.model");
const sendInvoiceEmail = require("../services/email.service");
const generateAppointmentPDF = require("../services/appointment-pdf.service");

// Create a new appointment
const createAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.create(req.body);

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully!",
      data: appointment,
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to book appointment.",
      error: error.message,
    });
  }
};

// Get all appointments
const getAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ createdAt: -1 });
    return res.json({
      success: true,
      total: appointments.length,
      data: appointments,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get appointment by ID
const getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found." });
    }
    return res.json({ success: true, data: appointment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update appointment status & handle confirmation email conditionally
const updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body; 
    console.log('data', req.body);

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status field is required.",
      });
    }

    // Prevent server crash if malformed Mongo ID is provided
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format.",
      });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    appointment.status = status.toLowerCase();
    await appointment.save();

    // Send email only when status is confirmed
    if (status.toLowerCase() === "confirmed") {
      // Guard clause: Only trigger email if recipient field actually exists
      if (!appointment.email) {
        console.warn(`[Warning] Appointment ${appointment._id} confirmed, but has no email address. Skipping notification.`);
      } else {
        try {
          const dateFormatted = new Date(appointment.appointmentDate).toLocaleDateString("en-CA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          const emailContent = getEmailTemplate(appointment, dateFormatted);

          await sendInvoiceEmail(
            [appointment.email],
            null,
            "Appointment Confirmed",
            emailContent
          );
        } catch (emailErr) {
          console.error("Appointment confirmation email failed to send:", emailErr);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Appointment status updated to ${status}.`,
      data: appointment,
    });
  } catch (error) {
    console.error("Error in updateAppointmentStatus handling:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error occurred.",
      error: error.message,
    });
  }
};

// Delete appointment
const deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found." });
    }
    await appointment.deleteOne();
    return res.json({ success: true, message: "Appointment deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Download appointment PDF
const downloadAppointmentPDF = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found." });
    }

    const filePath = await generateAppointmentPDF(appointment);
    
    res.download(filePath, `appointment-${appointment._id}.pdf`, (err) => {
      if (err) {
        console.error("Error downloading PDF:", err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: "Error downloading PDF" });
        }
      }
    });
  } catch (error) {
    console.error("Error generating appointment PDF:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Helper HTML template function to clean up core logic
const getEmailTemplate = (appointment, dateFormatted) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Confirmed</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5;">
      <tr>
        <td style="padding: 20px 0;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 30px; background-color: #1e3a8a; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Appointment Confirmed</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px; color: #334155;">
                <p style="font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">Dear ${appointment.contactPerson || appointment.companyName},</p>
                <p style="font-size: 14px; line-height: 1.6; margin: 0 0 25px 0;">Your appointment has been confirmed! Here are your appointment details:</p>
                
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 15px;">
                      <h2 style="margin: 0 0 15px 0; color: #1e3a8a; font-size: 16px; font-weight: bold;">Company Details</h2>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr><td style="padding: 5px 0; font-size: 14px; line-height: 1.6;"><strong>Company:</strong> ${appointment.companyName}</td></tr>
                        <tr><td style="padding: 5px 0; font-size: 14px; line-height: 1.6;"><strong>Contact Person:</strong> ${appointment.contactPerson || "N/A"}</td></tr>
                        <tr><td style="padding: 5px 0; font-size: 14px; line-height: 1.6;"><strong>Email:</strong> ${appointment.email}</td></tr>
                        <tr><td style="padding: 5px 0; font-size: 14px; line-height: 1.6;"><strong>Phone:</strong> ${appointment.phone}</td></tr>
                        ${appointment.address ? `<tr><td style="padding: 5px 0; font-size: 14px; line-height: 1.6;"><strong>Address:</strong> ${appointment.address}</td></tr>` : ""}
                        ${appointment.gstHst ? `<tr><td style="padding: 5px 0; font-size: 14px; line-height: 1.6;"><strong>GST/HST:</strong> ${appointment.gstHst}</td></tr>` : ""}
                      </table>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 15px;">
                      <h2 style="margin: 0 0 15px 0; color: #1e3a8a; font-size: 16px; font-weight: bold;">Appointment Details</h2>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr><td style="padding: 5px 0; font-size: 14px; line-height: 1.6;"><strong>Date:</strong> ${dateFormatted}</td></tr>
                        <tr><td style="padding: 5px 0; font-size: 14px; line-height: 1.6;"><strong>Time:</strong> ${appointment.appointmentTime}</td></tr>
                        <tr><td style="padding: 5px 0; font-size: 14px; line-height: 1.6;"><strong>Service:</strong> ${appointment.serviceType}</td></tr>
                        ${appointment.notes ? `<tr><td style="padding: 5px 0; font-size: 14px; line-height: 1.6;"><strong>Notes:</strong> ${appointment.notes}</td></tr>` : ""}
                      </table>
                    </td>
                  </tr>
                </table>
                
                <p style="font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">We will contact you shortly to confirm the appointment.</p>
                <p style="font-size: 12px; color: #64748b; margin: 20px 0 0 0;">— Dispatch Group Team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>


module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  deleteAppointment,
  downloadAppointmentPDF,
};