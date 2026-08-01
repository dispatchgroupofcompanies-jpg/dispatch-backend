const mongoose = require("mongoose");
const axios = require("axios");
const Appointment = require("../models/appointment.model");
const sendInvoiceEmail = require("../services/email.service");
const generateAppointmentPDF = require("../services/appointment-pdf.service");
const getEmailTemplate = require("../services/appointment-email.service");

// Create a new appointment
const createAppointment = async (req, res) => {
  try {    
    // Add userId from authenticated user
    const appointmentData = {
      ...req.body,
      userId: req.user._id,
    };
    const appointment = await Appointment.create(appointmentData)
    const recipientEmail = appointment.carrierEmail || appointment.email;
    if (recipientEmail) {
      try {
        // Format dates
        const dateFormatted = appointment.appointmentDate 
          ? new Date(appointment.appointmentDate).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }) 
          : "N/A";

        const pickupDateOpt = appointment.pickupDate 
          ? new Date(appointment.pickupDate).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }) 
          : "N/A";

        const deliveryDateOpt = appointment.deliveryDate 
          ? new Date(appointment.deliveryDate).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }) 
          : "N/A";

        const emailContent = getEmailTemplate(appointment, dateFormatted, pickupDateOpt, deliveryDateOpt);
        
        const pdfUrl = await generateAppointmentPDF(appointment);
        
        
        // Save Cloudinary URL to appointment
        appointment.pdfUrl = pdfUrl;
        await appointment.save();
        
        console.log("📤 Sending email to:", recipientEmail);
        
        const emailResult = await sendInvoiceEmail(
          [recipientEmail],
          pdfUrl,
          "Appointment Confirmation", 
          "Appointment Confirmation", 
          emailContent 
        );
        
       
      } catch (emailErr) {
        console.error(`❌ ERROR: Appointment confirmation email failed to send`);
        console.error("📧 Email Error Details:", {
          error: emailErr.message,
          code: emailErr.code,
          to: recipientEmail,
          subject: "Appointment Confirmation"
        });
        // Don't fail the appointment creation if email fails
      }
    } else {
      console.warn("⚠️ WARNING: Appointment created but no email address found. Skipping notification.");
    }

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully!",
      data: appointment,
    });
  } catch (error) {
    console.error("❌ ERROR: Failed to create appointment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to book appointment.",
      error: error.message,
    });
  }
};

// Get all appointments (user-specific or all for admin)
const getAppointments = async (req, res) => {
  try {
    let query = {};
    
    // If user is not admin, filter by userId
    if (req.accountType !== "admin") {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "User not authenticated" 
        });
      }
      query.userId = userId;
    }
    
    const appointments = await Appointment.find(query).sort({ createdAt: -1 });
    return res.json({
      success: true,
      total: appointments.length,
      data: appointments,
    });
  } catch (error) {
    console.error("Error in getAppointments:", error);
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
    
    // Check if user owns this appointment (admin can access all)
    if (req.accountType !== "admin" && appointment.userId?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied. You can only view your own appointments." });
    }
    
    return res.json({ success: true, data: appointment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update Appointment Status and Send Notification
const updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body; 

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

    // Check if user owns this appointment (admin can update all)
    if (req.accountType !== "admin" && appointment.userId?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied. You can only update your own appointments." });
    }

    appointment.status = status.toLowerCase();
    await appointment.save();
    
    // Send email notification on any status change
    console.log(`📧 STEP 3: Attempting to send status update email for status: ${status}...`);
    
    // Guard clause: Only trigger email if recipient field actually exists
    const recipientEmail = appointment.carrierEmail || appointment.email;
    
    if (!recipientEmail) {
      const warningMsg = `⚠️ WARNING: Appointment ${appointment._id} status changed to ${status}, but has no email address. Skipping notification.`;
      console.warn(warningMsg);
    } else {
      try {
        // Format primary appointment date with clean fallback safety
        const dateFormatted = appointment.appointmentDate 
          ? new Date(appointment.appointmentDate).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }) 
          : "N/A";

        // Format routing schedule dates for the invoice presentation tables
        const pickupDateOpt = appointment.pickupDate 
          ? new Date(appointment.pickupDate).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }) 
          : "N/A";

        const deliveryDateOpt = appointment.deliveryDate 
          ? new Date(appointment.deliveryDate).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }) 
          : "N/A";

        console.log("📄 Generating email template...");
        const emailContent = getEmailTemplate(appointment, dateFormatted, pickupDateOpt, deliveryDateOpt);
        
        console.log("📄 Generating appointment PDF...");
        // Pass formatted variables or handle layout sync inside the PDF script
        const pdfUrl = await generateAppointmentPDF(appointment);
        console.log("✅ PDF generated and uploaded to Cloudinary:", pdfUrl);
        
        // Save Cloudinary URL to appointment
        appointment.pdfUrl = pdfUrl;
        await appointment.save();
        
        console.log("📤 Sending email to:", recipientEmail);
        
        const emailResult = await sendInvoiceEmail(
          [recipientEmail],
          pdfUrl, // Pass Cloudinary URL directly
          `Appointment Status Update - ${status.charAt(0).toUpperCase() + status.slice(1)}`, 
          `Appointment Status Update - ${status.charAt(0).toUpperCase() + status.slice(1)}`, 
          emailContent 
        );
        
        console.log(`✅ STEP 4: Email sent successfully for status: ${status}`);
        console.log("📬 Email Details:", {
          to: recipientEmail,
          subject: `Appointment Status Update - ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          messageId: emailResult?.messageId,
          response: emailResult?.response,
          pdfAttached: true
        });
      } catch (emailErr) {
        console.error(`❌ ERROR: Appointment status update email failed to send for status: ${status}`);
        console.error("📧 Email Error Details:", {
          error: emailErr.message,
          code: emailErr.code,
          to: recipientEmail,
          subject: `Appointment Status Update - ${status.charAt(0).toUpperCase() + status.slice(1)}`
        });
      }
    }

    console.log("✅ STEP 5: Status update completed successfully");
    
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

// Update appointment
const updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found." });
    }

    // Check if user owns this appointment (admin can update all)
    if (req.accountType !== "admin" && appointment.userId?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied. You can only update your own appointments." });
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: "after", runValidators: true }
    );
    
    return res.json({ success: true, message: "Appointment updated successfully!", data: updatedAppointment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete appointment
const deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found." });
    }

    // Check if user owns this appointment (admin can delete all)
    if (req.accountType !== "admin" && appointment.userId?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied. You can only delete your own appointments." });
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

    // Check if user owns this appointment (admin can access all)
    if (req.accountType !== "admin" && appointment.userId?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied. You can only download your own appointments." });
    }

    const filename = `appointment-${appointment._id}.pdf`;

    try {
      let pdfUrl = appointment.pdfUrl;

      // Check if we have a Cloudinary URL stored
      if (!pdfUrl || (!pdfUrl.startsWith("http://") && !pdfUrl.startsWith("https://"))) {
        // Generate new PDF if not stored or old local path
        console.log("📄 Generating new PDF...");
        pdfUrl = await generateAppointmentPDF(appointment);
        
        // Save Cloudinary URL to appointment
        appointment.pdfUrl = pdfUrl;
        await appointment.save();
        console.log("✅ Cloudinary URL saved:", pdfUrl);
      } else {
        console.log("📥 Using existing Cloudinary URL:", pdfUrl);
      }
      
      // Fetch from Cloudinary
      console.log("📥 Downloading PDF from Cloudinary:", pdfUrl);
      const response = await axios.get(pdfUrl, { responseType: "stream" });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Transfer-Encoding", "binary");
      
      response.data.pipe(res);
    } catch (downloadError) {
      console.error("❌ Error in PDF download stream:", downloadError);
      // If streaming fails, try to send the URL as JSON instead
      if (appointment.pdfUrl) {
        return res.json({
          success: true,
          message: "Direct download failed. PDF URL provided instead.",
          pdfUrl: appointment.pdfUrl,
          filename: filename
        });
      } else {
        throw downloadError;
      }
    }
  } catch (error) {
    console.error("Error downloading appointment PDF:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  updateAppointment,
  deleteAppointment,
  downloadAppointmentPDF,
};
