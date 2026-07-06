const mongoose = require("mongoose");
const Appointment = require("../../models/appointment.model");
const sendInvoiceEmail = require("../../services/email.service");
const generateAppointmentPDF = require("../../services/appointment-pdf.service");

// Admin: Get all appointments (with user-based access control)
exports.getAppointments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    
    // If user is not admin, only show their own appointments
    if (req.accountType !== "admin") {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "User not authenticated" 
        });
      }
      filter.userId = userId;
    }

    const totalAppointments = await Appointment.countDocuments(filter);
    const appointments = await Appointment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Populate user information for each appointment
    const appointmentsWithUserInfo = await Promise.all(
      appointments.map(async (appointment) => {
        if (appointment.userId) {
          try {
            const User = require("../../models/user.model");
            const user = await User.findById(appointment.userId).select("name email");
            return {
              ...appointment.toObject(),
              createdByUser: user ? { name: user.name, email: user.email } : null
            };
          } catch (error) {
            console.error("Error fetching user for appointment:", error);
            return {
              ...appointment.toObject(),
              createdByUser: null
            };
          }
        }
        return {
          ...appointment.toObject(),
          createdByUser: null
        };
      })
    );

    return res.json({
      success: true,
      total: appointments.length,
      totalPages: Math.ceil(totalAppointments / limit),
      currentPage: page,
      data: appointmentsWithUserInfo,
    });
  } catch (error) {
    console.error("Error in getAppointments:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Get appointment by ID
exports.getAppointmentById = async (req, res) => {
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

// Admin: Update appointment status
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body; 

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status field is required.",
      });
    }

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
      const recipientEmail = appointment.carrierEmail || appointment.email;
      
      console.log(`📧 Appointment ${appointment._id} status changed to: ${status}`);
      console.log(`📧 Recipient email: ${recipientEmail}`);
      
      if (!recipientEmail) {
        console.warn(`⚠️ WARNING: Appointment ${appointment._id} confirmed, but has no email address.`);
      } else {
        try {
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

          console.log(`📧 Generating PDF for appointment: ${appointment._id}`);
          const emailContent = getEmailTemplate(appointment, dateFormatted, pickupDateOpt, deliveryDateOpt);
          const pdfPath = await generateAppointmentPDF(appointment, emailContent);
          
          console.log(`📧 PDF generated at: ${pdfPath}`);
          console.log(`📧 Sending email to: ${recipientEmail}`);
          
          await sendInvoiceEmail(
            [recipientEmail],
            pdfPath,
            "Appointment Confirmed", 
            "Appointment Confirmed", 
            emailContent 
          );
          
          console.log(`✅ Appointment confirmation email sent successfully for: ${appointment._id}`);
        } catch (emailErr) {
          console.error("❌ ERROR: Appointment confirmation email failed:", emailErr);
          console.error("Error details:", emailErr.message);
          if (emailErr.code) console.error("Error code:", emailErr.code);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Appointment status updated to ${status}.`,
      data: appointment,
    });
  } catch (error) {
    console.error("Error in updateAppointmentStatus:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error occurred.",
      error: error.message,
    });
  }
};

// Admin: Delete appointment
exports.deleteAppointment = async (req, res) => {
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

// Admin: Download appointment PDF
exports.downloadAppointmentPDF = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found." });
    }

    const dateFormatted = appointment.appointmentDate 
      ? new Date(appointment.appointmentDate).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) 
      : "N/A";

    const pickupDateOpt = appointment.pickupDate 
      ? new Date(appointment.pickupDate).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) 
      : "N/A";

    const deliveryDateOpt = appointment.deliveryDate 
      ? new Date(appointment.deliveryDate).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) 
      : "N/A";

    const fullHtmlLayout = getEmailTemplate(appointment, dateFormatted, pickupDateOpt, deliveryDateOpt);
    const filePath = await generateAppointmentPDF(appointment, fullHtmlLayout);
    
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

// Helper HTML template function
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

              <div style="height: 40px;"></div>

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