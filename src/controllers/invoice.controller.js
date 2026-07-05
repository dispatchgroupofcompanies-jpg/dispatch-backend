const Invoice = require("../models/invoice.model");
const generateInvoiceNumber = require("../services/invoiceNumber.service");
const calculateInvoice = require("../services/invoiceCalculation.service");
const path = require("path");
const generateInvoicePDF = require("../services/pdf.service");
const sendInvoiceEmail = require("../services/email.service");

const createInvoice = async (req, res) => {
  try {
    const data = req.body;
    if (!data?.trips?.length) {
      return res.status(400).json({
        success: false,
        message: "At least one trip is required to compile an invoice.",
      });
    }

    // Invoice calculation utility trigger
    const calculated = calculateInvoice(data.trips);

    // STEP: Ensure loadId1, loadId2 and driverName pass safely into the mapped calculated trips array
    const finalizedTrips = calculated.trips.map((calculatedTrip, index) => {
      const originalTrip = data.trips[index];
      
      // Agar VRID 'T' se start hota hai, toh input standard uppercase structure clear karega
      const cleanVrid = originalTrip?.vrid ? String(originalTrip.vrid).trim().toUpperCase() : "";

      return {
        ...calculatedTrip,
        vrid: cleanVrid,
        // Passing loadId1, loadId2 and driverName securely if present
        loadId1: cleanVrid.startsWith("T") && originalTrip?.loadId1 
          ? String(originalTrip.loadId1).trim() 
          : originalTrip?.loadId1 || undefined,
        loadId2: cleanVrid.startsWith("T") && originalTrip?.loadId2 
          ? String(originalTrip.loadId2).trim() 
          : originalTrip?.loadId2 || undefined,
        driverName: cleanVrid.startsWith("T") && originalTrip?.driverName 
          ? String(originalTrip.driverName).trim() 
          : originalTrip?.driverName || undefined,
        route: originalTrip?.route,
        pickup: originalTrip?.pickup,
        drop: originalTrip?.drop,
      };
    });

    const invoiceNumber = await generateInvoiceNumber();    
    const invoicePayload = {
      ...data,
      invoiceNumber,
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

    // Yahan Mongoose schema strict dynamically valid validation test pass karega
    const invoice = await Invoice.create(invoicePayload);

    let pdfPath = null;
    try {
      pdfPath = await generateInvoicePDF(invoice);
      
      invoice.pdfUrl = `/uploads/invoices/invoice-${invoice.invoiceNumber}.pdf`;
      await invoice.save();
    } catch (err) {
      console.error("❌ STEP 6b: PDF Render Engine Exception encountered:", err.message);
    }

    return res.status(201).json({
      success: true,
      message: "Invoice compiled and saved to cloud databases. Waiting for status updates.",
      data: invoice,
    });

  } catch (error) {
    console.error("🔥 SYSTEM FAILURE INSIDE CREATE INVOICE DISPATCH HOOK:", error);
    
    // Agar mongoose validation fail hogi (Load ID skip karne par), toh yeh specific error feedback dega
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Database schema validation tracking broke down.",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal runtime server core crash detected.",
      error: error.message,
    });
  }
};

// 2. GET ALL INVOICES (user-specific or all for admin)
const getInvoiceList = async (req, res) => {
  try {
    console.log("🔍 getInvoiceList - req.user:", req.user ? "exists" : "undefined");
    console.log("🔍 getInvoiceList - req.accountType:", req.accountType);
    
    let query = {};
    
    // If user is not admin, filter by createdBy
    if (req.accountType !== "admin") {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "User not authenticated" 
        });
      }
      query.createdBy = userId;
    }
    
    const invoices = await Invoice.find(query).sort({ createdAt: -1 });
    return res.json({
      success: true,
      total: invoices.length,
      data: invoices,
    });
  } catch (error) {
    console.error("Error in getInvoiceList:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }
    return res.json({ success: true, data: invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    Object.assign(invoice, req.body);

    if (req.body.trips) {
      const result = calculateInvoice(req.body.trips);
      invoice.trips = result.trips;
      invoice.subtotal = result.subtotal;
      invoice.tax = result.tax;
      invoice.grandTotal = result.grandTotal;
    }

    // PDF ko regenerate karein agar data update hua ho
    try {
      await generateInvoicePDF(invoice);
    } catch (pdfErr) {
      console.error("⚠️ PDF Refresh failed during update:", pdfErr.message);
    }

    await invoice.save();
    return res.json({
      success: true,
      message: "Invoice updated successfully.",
      data: invoice,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }
    await invoice.deleteOne();
    return res.json({ success: true, message: "Invoice deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateInvoiceStatus = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { invoiceStatus } = req.body;

    if (!invoiceStatus) {
      return res.status(400).json({
        success: false,
        message: "invoiceStatus field is required in request body.",
      });
    }

    const normalizedStatus = invoiceStatus.toLowerCase();

    // Database Object load hook
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    invoice.invoiceStatus = normalizedStatus;
    await invoice.save();

    if (normalizedStatus === "paid") {
      
      const pdfPath = path.join(__dirname, "../..", invoice.pdfUrl || ""); 
      const recipientsList = [
        invoice.customer?.email,
        invoice.payee?.email,
        "dispatchgroupofcompanies@gmail.com"
      ].filter(Boolean);

      if (recipientsList.length > 0) {
        try {
          await sendInvoiceEmail(recipientsList, pdfPath, invoice.invoiceNumber);
          
          invoice.emailStatus = "sent";
          invoice.emailSentAt = new Date();
          await invoice.save();
        } catch (mailErr) {
          invoice.emailStatus = "failed";
          await invoice.save();
          console.error("❌ Email delivery failed:", mailErr.message);
        }
      } else {
        console.log("⚠️ Email transmission skipped: No recipient list registered.");
      }
    }

    return res.status(200).json({
      success: true,
      message: `Status successfully synchronized to ${normalizedStatus}.`,
      data: invoice,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// SINGLE CLEAN EXPORT DECLARATION FOR THE MODULE
module.exports = {
  createInvoice,
  getInvoiceList,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  updateInvoiceStatus
};