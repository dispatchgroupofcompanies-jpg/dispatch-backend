const mongoose = require("mongoose");
const axios = require("axios");
const Appointment = require("../models/appointment.model");
const sendInvoiceEmail = require("../services/email.service");
const generateAppointmentPDF = require("../services/appointment-pdf.service");

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
      { new: true, runValidators: true }
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

// Helper HTML template function to clean up core logic
const getEmailTemplate = (appointment, dateFormatted, pickupDateOpt, deliveryDateOpt) => {
  const getValue = (value, fallback = "N/A") => value || fallback;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rate Confirmation / Confirmation Details</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f6f9; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="750" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 4px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          
          <tr>
            <td style="background-color: #0f172a; padding: 25px 35px; border-radius: 4px 4px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Confirmation Details</h1>
                    <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 13px;">ID: #${getValue(appointment._id)}</p>
                  </td>
                  <td align="right" valign="bottom">
                    <p style="margin: 0; color: #cbd5e1; font-size: 13px; font-weight: 600;">Generated: ${new Date().toLocaleDateString('en-CA', {year: 'numeric', month: 'short', day: 'numeric'})}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 25px 35px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="33%" valign="top">
                    <strong style="display:block; font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Trip Number</strong>
                    <span style="font-size: 15px; font-weight: 600; color: #0f172a;">${getValue(appointment.tripNumber)}</span>
                  </td>
                  <td width="33%" valign="top">
                    <strong style="display:block; font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Load Confirmation</strong>
                    <span style="font-size: 15px; font-weight: 600; color: #0f172a;">${getValue(appointment.loadConfirmationNumber)}</span>
                  </td>
                  <td width="34%" valign="top">
                    <strong style="display:block; font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Shipment Reference</strong>
                    <span style="font-size: 15px; font-weight: 600; color: #0f172a;">${getValue(appointment.shipmentNumber)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 35px;">
              
              <h2 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px; letter-spacing: 0.5px;">Carrier & Equipment Information</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 30px;">
                <tr>
                  <td width="50%" valign="top" style="padding-right: 15px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="4" border="0">
                      <tr>
                        <td width="35%" valign="top" style="font-size: 13px; color: #64748b; font-weight: 600;">Carrier Name:</td>
                        <td style="font-size: 13px; color: #1e293b;">${getValue(appointment.carrierName)}</td>
                      </tr>
                      <tr>
                        <td valign="top" style="font-size: 13px; color: #64748b; font-weight: 600;">Phone:</td>
                        <td style="font-size: 13px; color: #1e293b;">${getValue(appointment.carrierPhone)}</td>
                      </tr>
                      <tr>
                        <td valign="top" style="font-size: 13px; color: #64748b; font-weight: 600;">Email:</td>
                        <td style="font-size: 13px; color: #1e293b; text-transform: lowercase;">${getValue(appointment.carrierEmail)}</td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" valign="top" style="padding-left: 15px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="4" border="0">
                      <tr>
                        <td width="40%" valign="top" style="font-size: 13px; color: #64748b; font-weight: 600;">Equipment Type:</td>
                        <td style="font-size: 13px; color: #1e293b;">${getValue(appointment.equipmentType)}</td>
                      </tr>
                      <tr>
                        <td valign="top" style="font-size: 13px; color: #64748b; font-weight: 600;">Carrier Address:</td>
                        <td style="font-size: 13px; color: #1e293b; line-height: 1.4;">${getValue(appointment.carrierAddress)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <h2 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px; letter-spacing: 0.5px;">Schedule & Routing</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 4px;">
                <tr style="background-color: #f8fafc;">
                  <th align="left" style="padding: 10px 15px; font-size: 12px; color: #475569; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Milestone</th>
                  <th align="left" style="padding: 10px 15px; font-size: 12px; color: #475569; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Location Detail</th>
                  <th align="left" style="padding: 10px 15px; font-size: 12px; color: #475569; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Schedule / Window</th>
                  <th align="left" style="padding: 10px 15px; font-size: 12px; color: #475569; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Ref #</th>
                </tr>
                <tr>
                  <td valign="top" style="padding: 15px; font-size: 13px; font-weight: 600; border-bottom: 1px solid #e2e8f0; color: #0284c7;">O: PICKUP</td>
                  <td valign="top" style="padding: 15px; font-size: 13px; border-bottom: 1px solid #e2e8f0; line-height: 1.4;">
                    <strong style="color: #0f172a;">${getValue(appointment.shipperName)}</strong><br>
                    ${getValue(appointment.shipperAddress)}<br>
                    ${getValue(appointment.shipperCity)}${appointment.shipperProvince ? ', ' + appointment.shipperProvince : ''} ${getValue(appointment.shipperPostalCode)}
                  </td>
                  <td valign="top" style="padding: 15px; font-size: 13px; border-bottom: 1px solid #e2e8f0; line-height: 1.4;">
                    Date: ${getValue(pickupDateOpt)}<br>
                    Time: ${getValue(appointment.pickupTimeStart)} - ${getValue(appointment.pickupTimeEnd)}
                  </td>
                  <td valign="top" style="padding: 15px; font-size: 13px; border-bottom: 1px solid #e2e8f0; color: #475569;">
                    PU#: ${getValue(appointment.pickupNumber)}
                  </td>
                </tr>
                <tr>
                  <td valign="top" style="padding: 15px; font-size: 13px; font-weight: 600; color: #16a34a;">D: DELIVERY</td>
                  <td valign="top" style="padding: 15px; font-size: 13px; line-height: 1.4;">
                    <strong style="color: #0f172a;">${getValue(appointment.consigneeName)}</strong><br>
                    ${getValue(appointment.consigneeAddress)}<br>
                    ${getValue(appointment.consigneeCity)}${appointment.consigneeProvince ? ', ' + appointment.consigneeProvince : ''} ${getValue(appointment.consigneePostalCode)}
                  </td>
                  <td valign="top" style="padding: 15px; font-size: 13px; line-height: 1.4;">
                    Date: ${getValue(deliveryDateOpt)}<br>
                    Time: ${getValue(appointment.deliveryTime)}
                  </td>
                  <td valign="top" style="padding: 15px; font-size: 13px; color: #475569;">
                    Drop#: ${getValue(appointment.dropOffNumber)}
                  </td>
                </tr>
              </table>

              <h2 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px; letter-spacing: 0.5px;">Cargo & Financial Summary</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 30px;">
                <tr>
                  <td width="55%" valign="top" style="padding-right: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="4" border="0">
                      <tr>
                        <td width="35%" style="font-size: 13px; color: #64748b; font-weight: 600;">Commodity:</td>
                        <td style="font-size: 13px; color: #1e293b;">${getValue(appointment.commodityDescription)}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #64748b; font-weight: 600;">Weight:</td>
                        <td style="font-size: 13px; color: #1e293b;">${appointment.weight ? appointment.weight + ' lbs' : 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #64748b; font-weight: 600;">Service Type:</td>
                        <td style="font-size: 13px; color: #1e293b;">${getValue(appointment.serviceType)}</td>
                      </tr>
                    </table>
                  </td>
                  <td width="45%" valign="top" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 15px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="4" border="0">
                      <tr>
                        <td style="font-size: 13px; color: #64748b;">Description:</td>
                        <td align="right" style="font-size: 13px; color: #1e293b; font-weight: 500;">${getValue(appointment.chargeDescription)}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #64748b;">Base Rate:</td>
                        <td align="right" style="font-size: 13px; color: #1e293b; font-weight: 500;">${appointment.rateAmount ? appointment.rateAmount.toFixed(2) : '0.00'}</td>
                      </tr>
                      <tr style="border-top: 1px solid #e2e8f0;">
                        <td style="font-size: 14px; font-weight: 700; color: #0f172a; padding-top: 8px;">Total Due:</td>
                        <td align="right" style="font-size: 14px; font-weight: 700; color: #0f172a; padding-top: 8px;">${appointment.totalAmount ? appointment.totalAmount.toFixed(2) : '0.00'} ${getValue(appointment.currency)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <h2 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px; letter-spacing: 0.5px;">Corporate Compliance Data</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 30px;">
                <tr>
                  <td width="50%" valign="top" style="padding-right: 15px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="4" border="0">
                      <tr>
                        <td width="40%" style="font-size: 13px; color: #64748b; font-weight: 600;">Contact Person:</td>
                        <td style="font-size: 13px; color: #1e293b;">${getValue(appointment.contactPerson)}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #64748b; font-weight: 600;">Phone:</td>
                        <td style="font-size: 13px; color: #1e293b;">${getValue(appointment.phone)}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #64748b; font-weight: 600;">Driver Cell:</td>
                        <td style="font-size: 13px; color: #1e293b;">${getValue(appointment.driverCellNumber)}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #64748b; font-weight: 600;">Carrier Pro #:</td>
                        <td style="font-size: 13px; color: #1e293b;">${getValue(appointment.carrierProNumber)}</td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" valign="top" style="padding-left: 15px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="4" border="0">
                      <tr>
                        <td width="35%" style="font-size: 13px; color: #64748b; font-weight: 600;">NSC #:</td>
                        <td style="font-size: 13px; color: #1e293b;">${getValue(appointment.nsc)}</td>
                      </tr>
                    
                      <tr>
                        <td style="font-size: 13px; color: #64748b; font-weight: 600;">GST/HST:</td>
                        <td style="font-size: 13px; color: #1e293b;">${getValue(appointment.gstHst)}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #64748b; font-weight: 600;">QST:</td>
                        <td style="font-size: 13px; color: #1e293b;">${getValue(appointment.qst)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${appointment.notesTerms || appointment.notes ? `
              <div style="margin-top: 25px; padding: 15px; background-color: #fafafa; border-left: 4px solid #64748b; font-size: 13px; line-height: 1.5; color: #475569; border-radius: 0 4px 4px 0;">
                <strong style="color: #0f172a; display: block; margin-bottom: 5px;">Special Instructions & Terms:</strong>
                ${appointment.notesTerms ? appointment.notesTerms : ''}
                ${appointment.notes ? '<br>' + appointment.notes : ''}
              </div>
              ` : ''}

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 35px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="60%" valign="bottom">
                    <span style="font-size: 12px; color: #64748b; display: block;">Authorized Electronic Signature:</span>
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 16px; font-weight: bold; color: #0f172a; border-bottom: 1px dashed #94a3b8; padding-bottom: 3px; display: inline-block; margin-top: 5px;">
                      ${getValue(appointment.signature, "Electronically Finalized Verification")}
                    </span>
                  </td>
                  <td width="40%" align="right" valign="bottom">
                    <span style="font-size: 12px; color: #64748b; display: block;">Authorization Date:</span>
                    <span style="font-size: 13px; color: #0f172a; font-weight: 600; display: block; margin-top: 5px;">
                      ${appointment.signatureDate ? new Date(appointment.signatureDate).toLocaleDateString("en-CA", {year: 'numeric', month: 'long', day: 'numeric'}) : dateFormatted}
                    </span>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td style="padding: 25px 35px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 4px 4px; text-align: center;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #334155;">${getValue(appointment.companyName, "Dispatch Group")}</p>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">
                ${appointment.addressLine1 ? appointment.addressLine1 : ''} ${appointment.addressLine2 ? appointment.addressLine2 : ''} ${appointment.city ? appointment.city : ''} ${appointment.province || appointment.state ? appointment.province || appointment.state : ''} ${appointment.postCode ? appointment.postCode : ''}
              </p>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: #94a3b8;">© ${new Date().getFullYear()} Dispatch Group. Confidential Logistics Transmission.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
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
