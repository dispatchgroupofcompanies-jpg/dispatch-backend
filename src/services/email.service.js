const nodemailer = require("nodemailer");

// Enhanced email function that supports both invoice and appointment emails
const sendInvoiceEmail = async (emailsList, pdfPath, invoiceNumber, customSubject, customHtml) => {

  try {

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const finalRecipients = Array.isArray(emailsList) ? emailsList.join(", ") : emailsList;

    // Use custom subject/html if provided, otherwise use default invoice template
    const subject = customSubject || `Invoice #${invoiceNumber} Generated — Dispatch Group`;
    const html = customHtml || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #334155;">
        <h2 style="color: #1e3a8a; margin-bottom: 10px;">Invoice #${invoiceNumber}</h2>
        <p style="font-size: 14px; line-height: 1.6;">Hello,</p>
        <p style="font-size: 14px; line-height: 1.6;">Please find attached your professional copy of Invoice #${invoiceNumber}.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="color: #1e3a8a; margin: 0 0 10px 0; font-size: 14px;">Payment Methods Available:</h3>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li><strong>Direct Deposit:</strong> See attached PDF for complete banking details</li>
            <li><strong>💥 E-Transfer:</strong> See attached PDF for E-Transfer email address</li>
          </ul>
        </div>
        
        <p style="font-size: 14px; line-height: 1.6;">Thank you for your business!</p>
        <p style="font-size: 12px; color: #64748b; margin-top: 20px;">— Dispatch Group Billing Team</p>
      </div>
    `;

    // Build attachments array only if pdfPath is provided
    const attachments = pdfPath ? [{
      filename: `invoice-${invoiceNumber}.pdf`,
      path: pdfPath,
    }] : [];

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
      mailOptions.text = `Hello,\n\nPlease find attached your professional copy of Invoice #${invoiceNumber}.\n\nPayment Methods:\n- Direct Deposit: See attached PDF for banking details\n- E-Transfer: See attached PDF for E-Transfer email address\n\nThank you for business!`;
      mailOptions.html = html;
    }

    // Add attachments if provided
    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const result = await transporter.sendMail(mailOptions);

    return result;
  } catch (error) {
    console.log("❌ EMAIL UTILITY FUNCTION CRASHED:");
    console.error(error);
    throw error;
  }
};

module.exports = sendInvoiceEmail;