const Invoice = require("../models/invoice.model");
const Appointment = require("../models/appointment.model");
const path = require("path");
const sendInvoiceEmail = require("../services/email.service");
exports.getadminDashboard = async (req, res) => {
  try {
    // 1. Total Invoices ka count
    const totalInvoices = await Invoice.countDocuments();

    // 2. Pending Invoices ka count
    const pendingInvoices = await Invoice.countDocuments({ invoiceStatus: "pending" });

    // 3. Approved Invoices ka count
    const approvedInvoices = await Invoice.countDocuments({ invoiceStatus: "approved" });

    // 4. Total Revenue (Grand Total ka sum)
    const revenueAggregation = await Invoice.aggregate([
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]);
    const totalRevenue = revenueAggregation[0] ? revenueAggregation[0].total : 0;

    // 5. Recent 5 Invoices (Table ke liye - Newest first)
    const recentInvoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalInvoices,
          pendingInvoices,
          approvedInvoices,
          totalRevenue,
        },
        recentInvoices,
      },
    });

  } catch (error) {
    console.error("Error fetching admin dashboard data:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

exports.getAllInvoices = async (req, res) => {
  try {
    console.log('requested data')
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.invoiceStatus = req.query.status.toLowerCase(); // Validation safety ke liye lowercase kiya
    }

    // 1. Total invoices ka count filter ke mutabik
    const totalInvoices = await Invoice.countDocuments(filter);

    // 2. Invoices database se nikalna (Newest First)
    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: invoices.length,
      totalPages: Math.ceil(totalInvoices / limit),
      currentPage: page,
      totalInvoices,
      data: invoices,
    });
  } catch (error) {
    console.error("Error fetching all invoices:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching invoices",
    });
  }
};

exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Frontend se "approved" ya "rejected" milega

    // Validation Check: Taaki schema enums ke bahar koi value throw na kare
    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed values are 'approved' or 'rejected'.",
      });
    }

    // WARNING FIX: 'new: true' ki jagah Mongoose deprecation warning se bachne ke liye 'returnDocument: "after"' use kiya
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
        const pdfPath = path.join(__dirname, "../..", updatedInvoice.pdfUrl || "");
        const recipientsList = [
          updatedInvoice.customer?.email,
          updatedInvoice.payee?.email,
          "dispatchgroupofcompanies@gmail.com"
        ].filter(Boolean);

        if (recipientsList.length > 0) {
          await sendInvoiceEmail(recipientsList, pdfPath, updatedInvoice.invoiceNumber);
          
          updatedInvoice.emailStatus = "sent";
          updatedInvoice.emailSentAt = new Date();
          await updatedInvoice.save();
        }
      } catch (mailErr) {
        console.error("❌ Email delivery failed:", mailErr.message);
        // Don't fail the request if email fails
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

exports.getAllApointments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalAppointments = await Appointment.countDocuments();

    const appointments = await Appointment.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: appointments.length,
      totalPages: Math.ceil(totalAppointments / limit),
      currentPage: page,
      totalAppointments,
      data: appointments,
    });
  }
  catch (error) {
    console.error("Error fetching all appointments:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching appointments",
    });
  }
};
