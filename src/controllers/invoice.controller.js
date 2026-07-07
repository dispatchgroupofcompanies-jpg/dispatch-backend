const Invoice = require("../models/invoice.model");
const axios = require("axios");
const generateInvoiceNumber = require("../services/invoiceNumber.service");
const calculateInvoice = require("../services/invoiceCalculation.service");
const path = require("path");
const generateInvoicePDF = require("../services/pdf.service");
const sendInvoiceEmail = require("../services/email.service");

// 1. CREATE INVOICE WITH AUTOMATIC CUSTOMER FALLBACK
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
    
    // 💡 FIX: Handling customer fallback data if frontend payload didn't send any
    let customerData = data.customer;
    if (!customerData && req.user) {
      customerData = {
        customerName: req.user.name || "N/A",
        companyName: req.user.companyName || "N/A",
        email: req.user.email || "N/A",
        phone: req.user.phone || "N/A",
        address1: req.user.address || "N/A",
        eTransfer: data.eTransfer || "N/A"
      };
    }

    // Log the incoming data for debugging
    console.log("📧 INVOICE CREATE - Incoming data:", JSON.stringify(data, null, 2));
    console.log("📧 INVOICE CREATE - Resolved Customer data:", JSON.stringify(customerData, null, 2));
    console.log("📧 INVOICE CREATE - Payee data:", JSON.stringify(data.payee, null, 2));
    
    const invoicePayload = {
      ...data,
      customer: customerData, // 👈 Ensures customer sub-document is always written to DB
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
    
    // Log the saved invoice to verify data
    console.log("✅ INVOICE CREATED - Saved to database:", JSON.stringify(invoice.toObject(), null, 2));
    console.log("✅ INVOICE CREATED - Customer:", JSON.stringify(invoice.customer, null, 2));
    console.log("✅ INVOICE CREATED - Payee:", JSON.stringify(invoice.payee, null, 2));

    let pdfUrl = null;
    try {
      console.log("📄 Generating PDF with invoice data...");
      pdfUrl = await generateInvoicePDF(invoice);
      
      // pdfUrl will be Cloudinary URL or local fallback
      invoice.pdfUrl = pdfUrl;
      await invoice.save();
      console.log("✅ PDF generated and URL saved:", pdfUrl);
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

// 2. GET ALL INVOICES
const getInvoiceList = async (req, res) => {
  try {
    console.log("🔍 getInvoiceList - req.user:", req.user ? "exists" : "undefined");
    console.log("🔍 getInvoiceList - req.accountType:", req.accountType);
    
    let query = {};
    
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

// 3. GET INVOICE BY ID
const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }
    
    if (req.accountType !== "admin" && invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied. You can only view your own invoices." });
    }
    
    return res.json({ success: true, data: invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. UPDATE INVOICE
const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    if (req.accountType !== "admin" && invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied. You can only update your own invoices." });
    }

    Object.assign(invoice, req.body);

    if (req.body.trips) {
      const result = calculateInvoice(req.body.trips);
      invoice.trips = result.trips;
      invoice.subtotal = result.subtotal;
      invoice.tax = result.tax;
      invoice.grandTotal = result.grandTotal;
    }

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

// 5. DELETE INVOICE
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    if (req.accountType !== "admin" && invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied. You can only delete your own invoices." });
    }

    await invoice.deleteOne();
    return res.json({ success: true, message: "Invoice deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. DOWNLOAD PDF
const downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    if (req.accountType !== "admin" && invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied. You can only download your own invoices." });
    }

    const filename = `Invoice-${invoice.invoiceNumber}.pdf`;

    try {
      let pdfUrl = invoice.pdfUrl;

      // Check if we have a Cloudinary URL stored
      if (!pdfUrl || (!pdfUrl.startsWith("http://") && !pdfUrl.startsWith("https://"))) {
        // Generate new PDF if not stored or old local path
        console.log("📄 Generating new PDF...");
        pdfUrl = await generateInvoicePDF(invoice);
        
        // Save Cloudinary URL to invoice
        invoice.pdfUrl = pdfUrl;
        await invoice.save();
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

// 7. UPDATE STATUS & DISPATCH EMAIL
const updateInvoiceStatus = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { invoiceStatus } = req.body;
    console.lo('hello world');

    if (!invoiceStatus) {
      return res.status(400).json({
        success: false,
        message: "invoiceStatus field is required in request body.",
      });
    }

    const normalizedStatus = invoiceStatus.toLowerCase();

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    if (req.accountType !== "admin" && invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied. You can only update status of your own invoices." });
    }

    invoice.invoiceStatus = normalizedStatus;
    await invoice.save();

    if (normalizedStatus === "paid" || normalizedStatus === "approved") {
      const pdfPath = invoice.pdfUrl || ""; 
      const recipientsList = [
        invoice.customer?.email,
        invoice.payee?.email,
        "xcdgoc@gmail.com"
      ].filter(Boolean);

      console.log("📧 EMAIL TRIGGER - Status:", normalizedStatus);
      console.log("📧 EMAIL TRIGGER - PDF URL:", pdfPath);
      console.log("📧 EMAIL TRIGGER - Recipients:", recipientsList);
      console.log("📧 EMAIL TRIGGER - Invoice Number:", invoice.invoiceNumber);

      if (recipientsList.length > 0) {
        try {
      console.log("📧 EMAIL TRIGGER - Starting email send...");
      await sendInvoiceEmail(recipientsList, pdfPath, invoice.invoiceNumber, null, null, invoice);
      
      invoice.emailStatus = "sent";
      invoice.emailSentAt = new Date();
      await invoice.save();
      console.log("✅ EMAIL TRIGGER - Email sent successfully");
        } catch (mailErr) {
          invoice.emailStatus = "failed";
          await invoice.save();
          console.error("❌ EMAIL TRIGGER - Email delivery failed:", mailErr.message);
          console.error("❌ EMAIL TRIGGER - Full error:", mailErr);
        }
      } else {
        console.log("⚠️ EMAIL TRIGGER - No recipient list registered.");
      }
    } else {
      console.log("ℹ️ EMAIL TRIGGER - Status is not 'paid' or 'approved':", normalizedStatus);
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

module.exports = {
  createInvoice,
  getInvoiceList,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  updateInvoiceStatus,
  downloadInvoicePDF
};