const Invoice = require("../../models/invoice.model");
const path = require("path");
const axios = require("axios");
const sendInvoiceEmail = require("../../services/email.service");
const generateInvoicePDF = require("../../services/pdf.service");
const { generateInvoicePdfBuffer } = generateInvoicePDF;
const { getPagination } = require("../../middleware/validation.middleware");

// Admin: Get all invoices with pagination and filters (with user-based access control)
exports.getAllInvoices = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 24 });

    const filter = {};
    
    // If user is not admin, only show their own invoices
    if (req.accountType !== "admin") {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "User not authenticated" 
        });
      }
      filter.createdBy = userId;
    }
    
    if (req.query.status) {
      filter.invoiceStatus = req.query.status.toLowerCase();
    }

    const totalInvoices = await Invoice.countDocuments(filter);
    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Calculate carrierNeedToPay and carrierNeedsToReceive for each invoice
    const invoicesWithCalculations = invoices.map(invoice => {
      let totalCarrierNeedToPay = 0;
      let totalCarrierNeedsToReceive = 0;

      if (invoice.trips && invoice.trips.length > 0) {
        invoice.trips.forEach(trip => {
          const totalCharges = Number(trip.totalCharges || 0);
          const dispatchPercentage = Number(trip.dispatchPercentage || trip.dispatchPercent || 10);
          const dispatchAmount = (totalCharges * dispatchPercentage) / 100;
          
          // Carrier needs to pay dispatch amount
          totalCarrierNeedToPay += dispatchAmount;
          // Carrier receives total charges minus dispatch amount
          totalCarrierNeedsToReceive += (totalCharges - dispatchAmount);
        });
      }

      return {
        ...invoice.toObject(),
        carrierNeedToPay: totalCarrierNeedToPay,
        carrierNeedsToReceive: totalCarrierNeedsToReceive
      };
    });

    // Populate user information for each invoice
    const invoicesWithUserInfo = await Promise.all(
      invoicesWithCalculations.map(async (invoice) => {
        if (invoice.createdBy) {
          try {
            const User = require("../../models/user.model");
            const user = await User.findById(invoice.createdBy).select("name email");
            return {
              ...invoice,
              createdByUser: user ? { name: user.name, email: user.email } : null
            };
          } catch (error) {
            console.error("Error fetching user for invoice:", error);
            return {
              ...invoice,
              createdByUser: null
            };
          }
        }
        return {
          ...invoice,
          createdByUser: null
        };
      })
    );

    res.status(200).json({
      success: true,
      count: invoices.length,
      totalPages: Math.ceil(totalInvoices / limit),
      currentPage: page,
      totalInvoices,
      data: invoicesWithUserInfo,
    });
  } catch (error) {
    console.error("Error fetching all invoices:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching invoices",
    });
  }
};

// Admin: Update invoice status (approve/reject)
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed values are 'approved' or 'rejected'.",
      });
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      id,
      { invoiceStatus: status },
      { returnDocument: "after", runValidators: true }
    );

    if (!updatedInvoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Send email when invoice is approved
    let emailSent = false;
    let emailError = null;
    
    if (status === "approved") {
      try {
        console.log(`📧 Attempting to send approval email for invoice: ${updatedInvoice.invoiceNumber}`);
        console.log(`📧 Invoice pdfUrl from DB: ${updatedInvoice.pdfUrl}`);
        
        // Determine the correct PDF path/URL
        let pdfPath = updatedInvoice.pdfUrl;
        
        // If pdfUrl is a Cloudinary URL (starts with http), use it directly
        if (pdfPath && (pdfPath.startsWith("http://") || pdfPath.startsWith("https://"))) {
          console.log(`📧 Using Cloudinary URL: ${pdfPath}`);
        } 
        // If pdfUrl is empty or invalid, we need to regenerate the PDF
        else {
          console.log(`⚠️ pdfUrl is missing or invalid, regenerating PDF...`);
          const generateInvoicePDF = require("../../services/pdf.service");
          pdfPath = await generateInvoicePDF(updatedInvoice);
          
          // Save the Cloudinary URL back to the invoice
          updatedInvoice.pdfUrl = pdfPath;
          await updatedInvoice.save();
          console.log(`✅ PDF regenerated and URL saved: ${pdfPath}`);
        }
        
        console.log(`📧 Final PDF Path/URL: ${pdfPath}`);
        
        const recipientsList = [
          updatedInvoice.customer?.email,
          updatedInvoice.payee?.email,
          "xcdgoc@gmail.com"
        ].filter(Boolean);
        

        if (recipientsList.length > 0) {
          // Attach the exact PDF produced from the backend invoice template.
          // This never depends on Cloudinary allowing a subsequent download.
          const pdfAttachment = await generateInvoicePdfBuffer(updatedInvoice);
          await sendInvoiceEmail(
            recipientsList,
            pdfAttachment,
            updatedInvoice.invoiceNumber,
            null,
            null,
            updatedInvoice.toObject()
          );
          
          updatedInvoice.emailStatus = "sent";
          updatedInvoice.emailSentAt = new Date();
          await updatedInvoice.save();
          
          emailSent = true;
          console.log(`✅ Email sent successfully for invoice: ${updatedInvoice.invoiceNumber}`);
        } else {
          console.warn(`⚠️ No recipients found for invoice: ${updatedInvoice.invoiceNumber}`);
        }
      } catch (mailErr) {
        console.error("❌ Email delivery failed:", mailErr);
        console.error("Error details:", mailErr.message);
        if (mailErr.code) console.error("Error code:", mailErr.code);
        emailError = mailErr;
        updatedInvoice.emailStatus = "failed";
        await updatedInvoice.save();
        // Don't throw - we still want to return success for the status update
      }
    }

    const responseMessage = emailError 
      ? `Invoice status updated to ${status} successfully! However, email notification failed to send.`
      : emailSent 
        ? `Invoice status updated to ${status} successfully! Approval email sent.`
        : `Invoice status updated to ${status} successfully!`;

    res.status(200).json({
      success: true,
      message: responseMessage,
      data: updatedInvoice,
    });
  } catch (error) {
    console.error("Error updating invoice status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating invoice status",
    });
  }
};

// Admin: Reject invoice
exports.rejectInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedInvoice = await Invoice.findByIdAndUpdate(
      id,
      { invoiceStatus: "rejected" },
      { returnDocument: "after", runValidators: true }
    );

    if (!updatedInvoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Invoice rejected successfully",
      data: updatedInvoice,
    });
  } catch (error) {
    console.error("Error rejecting invoice:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while rejecting invoice",
    });
  }
};

// Admin: Download invoice PDF (no ownership check - admins can download any invoice)
exports.downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    const filename = `Invoice-${invoice.invoiceNumber}.pdf`;

    // Cloudinary is rejecting raw-file delivery with a 401 ACL error. Send
    // the generated PDF directly to this authenticated request instead.
    const pdfBuffer = await generateInvoicePdfBuffer(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);

    try {
      // Always generate new PDF to ensure latest template is used
      console.log("📄 Generating fresh PDF with latest template...");
      const pdfUrl = await generateInvoicePDF(invoice);
      
      // Save Cloudinary URL to invoice
      invoice.pdfUrl = pdfUrl;
      await invoice.save();
      console.log("✅ Fresh PDF generated and URL saved:", pdfUrl);
      
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
      if (invoice.pdfUrl) {
        return res.json({
          success: true,
          message: "Direct download failed. PDF URL provided instead.",
          pdfUrl: invoice.pdfUrl,
          filename: filename
        });
      } else {
        throw downloadError;
      }
    }
  } catch (error) {
    console.error("Error downloading invoice PDF:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
