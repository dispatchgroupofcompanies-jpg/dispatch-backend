const nodemailer = require("nodemailer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { generateInvoiceEmailHtml } = require("./email-template.service");
const { getPayeeSerialNumber } = require("./invoiceNumber.service");

// Get email-safe HTML directly without frontend dependency
const getEmailHtmlFromBackend = async (invoice, type = "invoice") => {
  try {
    if (type === "invoice") {
      return generateInvoiceEmailHtml(invoice);
    }
    // For appointments, you can add a similar service
    throw new Error("Appointment emails not yet implemented in backend");
  } catch (error) {
    console.error("Error generating email HTML:", error);
    throw error;
  }
};

// Create email transporter based on environment
const createEmailTransporter = async () => {
  const emailService = process.env.EMAIL_SERVICE || 'gmail';
  
  console.log(`📧 Using email service: ${emailService}`);

  if (emailService === 'sendgrid') {
    // SendGrid Configuration (for production/Render)
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY is required when using SendGrid");
    }
    
    console.log("📧 Configuring SendGrid transporter...");
    const transporter = nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",  // SendGrid uses "apikey" as username
        pass: process.env.SENDGRID_API_KEY,
      },
    });
    
    await transporter.verify();
    console.log("✅ SendGrid transporter verified");
    return transporter;
  } else {
    // Gmail Configuration (for local development)
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("EMAIL_USER and EMAIL_PASS are required for Gmail");
    }

    console.log(`📧 Configuring Gmail transporter for: ${process.env.EMAIL_USER}`);
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.verify();
    console.log("✅ Gmail transporter verified");
    return transporter;
  }
};

// Enhanced email function that supports both invoice and appointment emails
// invoiceData is optional - if provided, it will be used to generate email body with full details
const sendInvoiceEmail = async (emailsList, pdfPath, invoiceNumber, customSubject, customHtml, invoiceData = null) => {

  try {
    const payeeSerialNumber = invoiceData
      ? await getPayeeSerialNumber(invoiceData)
      : invoiceNumber;
    console.log("📧 EMAIL SERVICE STARTED");
    console.log(`📧 To: ${JSON.stringify(emailsList)}`);
    console.log(`📧 Subject: ${customSubject || `Invoice #${payeeSerialNumber}`}`);
    console.log(`📧 PDF Path: ${pdfPath}`);
    console.log(`📧 Has PDF: ${pdfPath ? 'Yes' : 'No'}`);

    // Check environment variables based on email service
    const emailService = process.env.EMAIL_SERVICE || 'gmail';
    
    if (emailService === 'sendgrid') {
      // SendGrid only needs EMAIL_USER and SENDGRID_API_KEY
      if (!process.env.EMAIL_USER) {
        throw new Error("EMAIL_USER is required for SendGrid");
      }
      if (!process.env.SENDGRID_API_KEY) {
        throw new Error("SENDGRID_API_KEY is required for SendGrid");
      }
    } else {
      // Gmail needs EMAIL_USER and EMAIL_PASS
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        const missingVars = [];
        if (!process.env.EMAIL_USER) missingVars.push("EMAIL_USER");
        if (!process.env.EMAIL_PASS) missingVars.push("EMAIL_PASS");
        throw new Error(`Missing environment variables: ${missingVars.join(", ")}`);
      }
    }

    console.log("📧 Creating email transporter...");
    
    // Create transporter based on environment
    const transporter = await createEmailTransporter();

    const finalRecipients = Array.isArray(emailsList) ? emailsList.join(", ") : emailsList;
    console.log(`📧 Final recipients: ${finalRecipients}`);

    // Use custom subject/html if provided, otherwise get email-safe HTML from frontend
    const subject = customSubject || `Invoice #${payeeSerialNumber} Generated — Dispatch Group`;
    let html = customHtml;
    
    if (!html) {
      try {
        // Use invoiceData if available, otherwise just send invoiceNumber
        const emailData = invoiceData
          ? { ...invoiceData, payeeSerialNumber }
          : { invoiceNumber: payeeSerialNumber, payeeSerialNumber };
        html = await getEmailHtmlFromBackend(emailData, "invoice");
      } catch (error) {
        console.error("Failed to generate email HTML, using simple fallback:", error);
        // Simple fallback without any PDF styling
        html = `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto;">
            <tr>
              <td style="padding: 20px; background-color: #ffffff;">
                <h1 style="margin: 0; font-size: 20px; font-weight: bold; color: #1e3a8a; text-transform: uppercase;">INVOICE</h1>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Invoice #: <strong>#${payeeSerialNumber}</strong></p>
                <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.5; color: #475569;">Please find attached your invoice as a PDF.</p>
              </td>
            </tr>
          </table>
        `;
      }
    }

    // Build attachments array only if pdfPath is provided
    let attachments = [];
    if (pdfPath) {
      // Check if pdfPath is a Cloudinary URL (starts with http:// or https://)
      if (pdfPath.startsWith("http://") || pdfPath.startsWith("https://")) {
        console.log("📧 Downloading PDF from Cloudinary...");
        try {
          const response = await axios.get(pdfPath, { responseType: "arraybuffer" });
          const tempPath = path.join(process.cwd(), "uploads", "temp-email-attachment.pdf");
          
          // Ensure temp directory exists
          const tempDir = path.dirname(tempPath);
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          fs.writeFileSync(tempPath, response.data);
          console.log("✅ PDF downloaded from Cloudinary to temp file");
          
          attachments = [{
            filename: `invoice-${payeeSerialNumber}.pdf`,
            path: tempPath,
          }];
        } catch (downloadError) {
          console.error("❌ Failed to download PDF from Cloudinary:", downloadError.message);
          // Continue without attachment
        }
      } else {
        // Local file path
        attachments = [{
          filename: `invoice-${payeeSerialNumber}.pdf`,
          path: pdfPath,
        }];
      }
    }

    const mailOptions = {
      from: `"Dispatch Group" <${process.env.EMAIL_USER}>`,
      to: finalRecipients, 
      subject: subject,
    };

    // If custom HTML is provided, send as HTML email
    if (customHtml) {
      mailOptions.html = customHtml;
      mailOptions.text = "Please view this email in HTML format.";
    } else {
      mailOptions.text = `Hello,\n\nPlease find attached your professional copy of Invoice #${payeeSerialNumber}.\n\nPayment Methods:\n- Direct Deposit: See attached PDF for banking details\n- E-Transfer: See attached PDF for E-Transfer email address\n\nThank you for your business!\n\n— Dispatch Group Billing Team`;
      mailOptions.html = html;
    }

    // Add attachments if provided
    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    console.log("📧 Sending email...");
    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully!");
    console.log(`📧 Message ID: ${result.messageId}`);

    // Clean up temp file if it was created
    if (attachments.length > 0 && attachments[0].path.includes("temp-email-attachment.pdf")) {
      try {
        fs.unlinkSync(attachments[0].path);
        console.log("🗑️ Temp attachment file cleaned up");
      } catch (cleanupError) {
        console.warn("⚠️ Could not clean up temp file:", cleanupError.message);
      }
    }

    return result;
  } catch (error) {
    console.log("❌ EMAIL UTILITY FUNCTION CRASHED:");
    console.error("Full error:", error);
    console.error("Error message:", error.message);
    if (error.code) console.error("Error code:", error.code);
    if (error.response) console.error("Error response:", error.response);
    
    // Provide helpful error messages for common issues
    if (error.code === 'EAUTH') {
      console.error("❌ AUTHENTICATION ERROR: Check EMAIL_USER and EMAIL_PASS in .env");
      console.error("   For Gmail, you need to use an App Password (not your regular password)");
      console.error("   Enable 2FA first, then create App Password at: https://myaccount.google.com/apppasswords");
    } else if (error.code === 'ECONNECTION') {
      console.error("❌ CONNECTION ERROR: Cannot connect to email server");
      console.error("   Check your internet connection and email service settings");
    } else if (error.message && error.message.includes('Invalid login')) {
      console.error("❌ INVALID LOGIN: Email credentials are incorrect");
      console.error("   For Gmail, make sure you're using an App Password, not your regular password");
    }
    
    throw error;
  }
};

module.exports = sendInvoiceEmail;
