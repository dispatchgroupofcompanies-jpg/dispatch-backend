const Invoice = require("../../models/invoice.model");
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");
const sendInvoiceEmail = require("../../services/email.service");
const generateInvoiceNumber = require("../../services/invoiceNumber.service");
const generateInvoicePDF = require("../../services/pdf.service");
const { generateInvoicePdfBuffer } = generateInvoicePDF;
const { getPagination } = require("../../middleware/validation.middleware");
const { uploadImageBufferToCloudinary, cloudinary } = require("../../services/cloudinary.service");
const { buildInvoiceFilename } = require("../../utils/filename.utils");
const calculateInvoice = require("../../services/invoiceCalculation.service");

// Helper: Handles MongoDB E11000 duplicate serial errors gracefully via auto-retry
const createInvoiceWithUniqueNumber = async (payload, maxRetries = 3) => {
  let attempt = 0;

  while (true) {
    try {
      return await Invoice.create(payload);
    } catch (err) {
      const isDuplicateInvoiceNumber = err.code === 11000 && err.keyPattern?.invoiceNumber;
      if (isDuplicateInvoiceNumber && attempt < maxRetries) {
        attempt += 1;
        const newNumber = await generateInvoiceNumber(payload.payee);
        payload.invoiceNumber = newNumber.invoiceNumber;
        payload.payeeKey = newNumber.payeeKey;
        payload.payeeSerialNumber = newNumber.serialNumber;
        continue;
      }
      throw err;
    }
  }
};

// Admin: Create new invoice directly
exports.createInvoice = async (req, res) => {
  try {
    const data = req.body;
    if (!data?.trips?.length) {
      return res.status(400).json({
        success: false,
        message: "At least one trip is required to compile an invoice.",
      });
    }

    // Run core calculations on provided trips
    const calculated = calculateInvoice(data.trips);

    // Clean inputs and preserve mixed-case strings
    const finalizedTrips = calculated.trips.map((calculatedTrip, index) => {
      const originalTrip = data.trips[index];
      const cleanVrid = originalTrip?.vrid ? String(originalTrip.vrid).trim() : "";

      return {
        ...calculatedTrip,
        vrid: cleanVrid,
        loadId1: originalTrip?.loadId1 ? String(originalTrip.loadId1).trim() : undefined,
        loadId2: originalTrip?.loadId2 ? String(originalTrip.loadId2).trim() : undefined,
        driverName: originalTrip?.driverName ? String(originalTrip.driverName).trim() : undefined,
        route: originalTrip?.route,
        pickup: originalTrip?.pickup,
        drop: originalTrip?.drop,
      };
    });

    const generatedNumber = await generateInvoiceNumber(data.payee);
    const invoicePayload = {
      ...data,
      invoiceNumber: generatedNumber.invoiceNumber,
      payeeKey: generatedNumber.payeeKey,
      payeeSerialNumber: generatedNumber.serialNumber,
      trips: finalizedTrips,
      subtotal: calculated.subtotal,
      tax: calculated.tax,
      grandTotal: calculated.grandTotal,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
      createdBy: req.user?._id || null,
    };

    if (Array.isArray(data.invoicePeriod) && data.invoicePeriod.length === 2) {
      invoicePayload.invoicePeriod = {
        startDate: new Date(data.invoicePeriod[0]),
        endDate: new Date(data.invoicePeriod[1]),
      };
    }

    const invoice = await createInvoiceWithUniqueNumber(invoicePayload);

    // Initial PDF generation step
    try {
      invoice.pdfUrl = await generateInvoicePDF(invoice);
      await invoice.save();
    } catch (err) {
      console.error("❌ PDF Render Engine Exception encountered:", err.message);
    }

    return res.status(201).json({
      success: true,
      message: "Invoice successfully created by admin.",
      data: invoice,
    });
  } catch (error) {
    console.error("🔥 ERROR CREATING INVOICE (ADMIN):", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating invoice.",
      error: error.message,
    });
  }
};

// Admin: Get all invoices with financial dispatch metrics
exports.getAllInvoices = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 1000 });

    const filter = {};
    if (req.accountType !== "admin") {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }
      filter.createdBy = userId;
    }

    if (req.query.status) {
      filter.invoiceStatus = req.query.status.toLowerCase();
    }

    const totalInvoices = await Invoice.countDocuments(filter);

    const invoices = await Invoice.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const invoicesWithCalculations = invoices.map((invoice) => {
      let totalCarrierNeedToPay = 0;
      let totalCarrierNeedsToReceive = 0;

      if (invoice.trips && invoice.trips.length > 0) {
        invoice.trips.forEach((trip) => {
          const totalCharges = Number(trip.totalCharges || 0);
          const dispatchPercentage = Number(trip.dispatchPercentage || trip.dispatchPercent || 10);
          const dispatchAmount = (totalCharges * dispatchPercentage) / 100;

          totalCarrierNeedToPay += dispatchAmount;
          totalCarrierNeedsToReceive += totalCharges - dispatchAmount;
        });
      }

      const invObj = invoice.toObject();

      return {
        ...invObj,
        carrierNeedToPay: totalCarrierNeedToPay,
        carrierNeedsToReceive: totalCarrierNeedsToReceive,
        createdByUser: invObj.createdBy ? { name: invObj.createdBy.name, email: invObj.createdBy.email } : null,
      };
    });

    res.status(200).json({
      success: true,
      count: invoicesWithCalculations.length,
      totalPages: Math.ceil(totalInvoices / limit),
      currentPage: page,
      totalInvoices,
      data: invoicesWithCalculations,
    });
  } catch (error) {
    console.error("❌ Error fetching all invoices:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching invoices",
      error: error.message,
    });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("createdBy", "name email");
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }
    return res.json({ success: true, data: invoice });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch invoice." });
  }
};

// Admin: Update invoice details and recalculate totals
exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    const {
      invoiceNumber,
      payeeKey,
      payeeSerialNumber,
      createdBy,
      pdfUrl,
      paymentStatus,
      paymentProofUrl,
      paymentProofPublicId,
      paidAt,
      shareToken,
      shareExpiresAt,
      emailStatus,
      emailSentAt,
      subtotal,
      tax,
      grandTotal,
      payee,
      trips,
      invoicePeriod,
      ...updates
    } = req.body;
    Object.assign(invoice, updates);

    if (payee) {
      invoice.payee = { ...(invoice.payee?.toObject?.() || {}), ...payee };
    }

    if (Array.isArray(invoicePeriod) && invoicePeriod.length === 2) {
      invoice.invoicePeriod = {
        startDate: new Date(invoicePeriod[0]),
        endDate: new Date(invoicePeriod[1]),
      };
    }

    if (trips) {
      const result = calculateInvoice(trips);
      invoice.trips = result.trips;
      invoice.subtotal = result.subtotal;
      invoice.tax = result.tax;
      invoice.grandTotal = result.grandTotal;
    }

    await invoice.save();

    // Re-render PDF to keep document visually in sync
    try {
      invoice.pdfUrl = await generateInvoicePDF(invoice);
      await invoice.save();
    } catch (pdfErr) {
      console.error("⚠️ PDF Refresh failed during update:", pdfErr.message);
    }

    return res.json({
      success: true,
      message: "Invoice updated successfully by admin.",
      data: invoice,
    });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Delete an invoice completely
exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    console.log("Attempting to delete invoice:", invoice?._id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    if (String(invoice.invoiceStatus).toLowerCase() === "approved") {
      return res.status(409).json({
        success: false,
        message: "Approved invoices cannot be deleted.",
      });
    }

    // Optional: Clean up proof from Cloudinary if attached
    if (invoice.paymentProofPublicId) {
      try {
        await cloudinary.uploader.destroy(invoice.paymentProofPublicId, { resource_type: "image" });
      } catch (cleanupError) {
        console.warn("⚠️ Could not delete payment proof asset:", cleanupError.message);
      }
    }

    await invoice.deleteOne();
    return res.json({ success: true, message: "Invoice deleted successfully from database." });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Update status (Approve / Reject) and notify client
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

    let emailSent = false;
    let emailError = null;

    if (status === "approved") {
      try {
        let pdfPath = updatedInvoice.pdfUrl;

        if (!pdfPath || (!pdfPath.startsWith("http://") && !pdfPath.startsWith("https://"))) {
          pdfPath = await generateInvoicePDF(updatedInvoice);
          updatedInvoice.pdfUrl = pdfPath;
          await updatedInvoice.save();
        }

        const recipientsList = [
          updatedInvoice.customer?.email,
          updatedInvoice.payee?.email,
          "xcdgoc@gmail.com",
        ].filter(Boolean);

        if (recipientsList.length > 0) {
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
        }
      } catch (mailErr) {
        console.error("❌ Email delivery failed:", mailErr);
        emailError = mailErr;
        updatedInvoice.emailStatus = "failed";
        await updatedInvoice.save();
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

// Admin: Direct payment status update and proof upload handling
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔍 LOG 4: Backend request incoming check
    console.log("🚀 [Backend Request ID]:", id);
    console.log("📦 [Backend req.body]:", req.body);
    console.log("📁 [Backend req.file (Multer Output)]:", req.file);

    const status = String(req.body.status || "").toLowerCase();

    if (!["pending", "paid"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status. Allowed values are 'pending' or 'paid'.",
      });
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (status === "paid") {
      if (!req.file) {
        // 🔴 AGAR YE LOG CHALE TO MULTER KO FILE NAHI MILI!
        console.error("❌ [Error]: req.file is undefined! Check Multer field name mismatch.");
        return res.status(400).json({
          success: false,
          message: "Payment proof image is required to mark the invoice as paid.",
        });
      }

      // Cloudinary Upload Call
      const upload = await uploadImageBufferToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "payment-proofs"
      );

      // 🔍 LOG 5: Cloudinary Output check karein
      console.log("☁️ [Cloudinary Upload Result]:", upload);

      if (invoice.paymentProofPublicId) {
        try {
          await cloudinary.uploader.destroy(invoice.paymentProofPublicId, {
            resource_type: "image",
          });
        } catch (cleanupError) {
          console.warn("⚠️ Could not delete old payment proof:", cleanupError.message);
        }
      }

      invoice.paymentStatus = "paid";
      // ⚠️ Dhyan dein: upload.secureUrl check karein agar upload.secure_url to nahi!
      invoice.paymentProofUrl = upload.secureUrl || upload.secure_url;
      invoice.paymentProofPublicId = upload.publicId || upload.public_id;
      invoice.paidAt = new Date();
    } else {
      // Pending logic...
      invoice.paymentStatus = "pending";
      invoice.paymentProofUrl = undefined;
      invoice.paymentProofPublicId = undefined;
      invoice.paidAt = undefined;
    }

    await invoice.save();

    // 🔍 LOG 6: Final Saved Invoice Object
    console.log("✅ [Saved Invoice in DB]:", invoice);

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${status} successfully!`,
      data: invoice,
    });
  } catch (error) {
    console.error("💥 [Error updating payment status]:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating payment status",
    });
  }
};

// Admin: Standard PDF download
exports.downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    const filename = buildInvoiceFilename(invoice);
    const pdfBuffer = await generateInvoicePdfBuffer(invoice);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Error downloading invoice PDF:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: PDF download including payment receipt proof page
exports.downloadPaidInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    if (String(invoice.paymentStatus).toLowerCase() !== "paid" || !invoice.paymentProofUrl) {
      return res.status(400).json({
        success: false,
        message: "This invoice does not have an attached payment proof.",
      });
    }

    const filename = buildInvoiceFilename(invoice, { paid: true });
    const pdfBuffer = await generateInvoicePdfBuffer(invoice, { includePaymentProof: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Error downloading paid invoice PDF:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
