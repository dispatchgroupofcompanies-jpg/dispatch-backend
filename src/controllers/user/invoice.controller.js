const Invoice = require("../../models/invoice.model");
const axios = require("axios");
const generateInvoicePDF = require("../../services/pdf.service");

// User: Create new invoice
exports.createInvoice = async (req, res) => {
  try {
    const data = req.body;
    if (!data?.trips?.length) {
      return res.status(400).json({
        success: false,
        message: "At least one trip is required to compile an invoice.",
      });
    }

    // Invoice calculation utility trigger
    const calculateInvoice = require("../../services/invoiceCalculation.service");
    const calculated = calculateInvoice(data.trips);

    // Ensure loadId1, loadId2 and driverName pass safely into the mapped calculated trips array
    const finalizedTrips = calculated.trips.map((calculatedTrip, index) => {
      const originalTrip = data.trips[index];
      
      const cleanVrid = originalTrip?.vrid ? String(originalTrip.vrid).trim().toUpperCase() : "";

      return {
        ...calculatedTrip,
        vrid: cleanVrid,
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

    const generateInvoiceNumber = require("../../services/invoiceNumber.service");
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

    const invoice = await Invoice.create(invoicePayload);

    try {
      await generateInvoicePDF(invoice);
      
      invoice.pdfUrl = `/uploads/invoices/invoice-${invoice.invoiceNumber}.pdf`;
      await invoice.save();
    } catch (err) {
      console.error("❌ PDF Render Engine Exception encountered:", err.message);
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

// User: Get own invoices only
exports.getInvoiceList = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Only get invoices created by this user
    const filter = { createdBy: userId };
    
    const totalInvoices = await Invoice.countDocuments(filter);
    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.json({
      success: true,
      total: invoices.length,
      totalPages: Math.ceil(totalInvoices / limit),
      currentPage: page,
      data: invoices,
    });
  } catch (error) {
    console.error("Error in getInvoiceList:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// User: Get invoice by ID (only if it belongs to user)
exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    // Check if invoice belongs to user
    if (invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have permission to access this invoice." 
      });
    }

    return res.json({ success: true, data: invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// User: Update own invoice
exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    // Check if invoice belongs to user
    if (invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have permission to update this invoice." 
      });
    }

    Object.assign(invoice, req.body);

    if (req.body.trips) {
      const calculateInvoice = require("../../services/invoiceCalculation.service");
      const result = calculateInvoice(req.body.trips);
      invoice.trips = result.trips;
      invoice.subtotal = result.subtotal;
      invoice.tax = result.tax;
      invoice.grandTotal = result.grandTotal;
    }

    // Regenerate PDF if data updated
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

// User: Delete own invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    // Check if invoice belongs to user
    if (invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have permission to delete this invoice." 
      });
    }

    await invoice.deleteOne();
    return res.json({ success: true, message: "Invoice deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// User: Update invoice status (for payment status)
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { invoiceStatus } = req.body;

    if (!invoiceStatus) {
      return res.status(400).json({
        success: false,
        message: "invoiceStatus field is required in request body.",
      });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    // Check if invoice belongs to user
    if (invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have permission to update this invoice." 
      });
    }

    const normalizedStatus = invoiceStatus.toLowerCase();
    invoice.invoiceStatus = normalizedStatus;
    await invoice.save();

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

// User: Download invoice PDF
exports.downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    // Check if invoice belongs to user
    if (invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have permission to download this invoice." 
      });
    }

    const filename = `Invoice-${invoice.invoiceNumber}.pdf`;

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
