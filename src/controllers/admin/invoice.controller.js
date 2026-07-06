const Invoice = require("../../models/invoice.model");
const path = require("path");
const sendInvoiceEmail = require("../../services/email.service");

// Admin: Get all invoices with pagination and filters (with user-based access control)
exports.getAllInvoices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

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
    if (status === "approved") {
      try {
        console.log(`📧 Attempting to send approval email for invoice: ${updatedInvoice.invoiceNumber}`);
        
        const pdfPath = path.join(process.cwd(), updatedInvoice.pdfUrl || "");
        console.log(`📧 PDF Path: ${pdfPath}`);
        console.log(`📧 PDF exists: ${require('fs').existsSync(pdfPath)}`);
        
        const recipientsList = [
          updatedInvoice.customer?.email,
          updatedInvoice.payee?.email,
          "dispatchgroupofcompanies@gmail.com"
        ].filter(Boolean);
        
        console.log(`📧 Recipients: ${JSON.stringify(recipientsList)}`);

        if (recipientsList.length > 0) {
          await sendInvoiceEmail(recipientsList, pdfPath, updatedInvoice.invoiceNumber);
          
          updatedInvoice.emailStatus = "sent";
          updatedInvoice.emailSentAt = new Date();
          await updatedInvoice.save();
          
          console.log(`✅ Email sent successfully for invoice: ${updatedInvoice.invoiceNumber}`);
        } else {
          console.warn(`⚠️ No recipients found for invoice: ${updatedInvoice.invoiceNumber}`);
        }
      } catch (mailErr) {
        console.error("❌ Email delivery failed:", mailErr);
        console.error("Error details:", mailErr.message);
        if (mailErr.code) console.error("Error code:", mailErr.code);
      }
    }

    res.status(200).json({
      success: true,
      message: `Invoice status updated to ${status} successfully!`,
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