const Invoice = require("../models/invoice.model");
const generateInvoiceNumber = require("../services/invoiceNumber.service");
const calculateInvoice = require("../services/invoiceCalculation.service");
const generateInvoicePDF = require("../services/pdf.service");

// 1. CREATE INVOICE
const createInvoice = async (req, res) => {
  try {
    const { trips, customer, payee, ...data } = req.body;
    
    if (!trips?.length) {
      return res.status(400).json({
        success: false,
        message: "At least one trip is required.",
      });
    }

    const calculated = calculateInvoice(trips);
    const generatedNumber = await generateInvoiceNumber(payee);

    // Handle customer fallback
    const customerData = customer || (req.user ? {
      customerName: req.user.name || "N/A",
      companyName: req.user.companyName || "N/A",
      email: req.user.email || "N/A",
      phone: req.user.phone || "N/A",
      address1: req.user.address || "N/A",
      eTransfer: data.eTransfer || "N/A",
      institutionNumber: data.institutionNumber || "N/A"
    } : null);

    const invoice = await Invoice.create({
      ...data,
      customer: customerData,
      invoiceNumber: generatedNumber.invoiceNumber,
      payeeKey: generatedNumber.payeeKey,
      payeeSerialNumber: generatedNumber.serialNumber,
      payee,
      trips: calculated.trips.map((trip, i) => ({
        ...trip,
        vrid: trips[i]?.vrid ? String(trips[i].vrid).trim() : "",
        loadId1: trips[i]?.loadId1 ? String(trips[i].loadId1).trim() : undefined,
        loadId2: trips[i]?.loadId2 ? String(trips[i].loadId2).trim() : undefined,
        driverName: trips[i]?.driverName ? String(trips[i].driverName).trim() : undefined,
        route: trips[i]?.route,
        pickup: trips[i]?.pickup,
        drop: trips[i]?.drop,
      })),
      subtotal: calculated.subtotal,
      tax: calculated.tax,
      grandTotal: calculated.grandTotal,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
      createdBy: req.user?._id || null,
      ...(data.invoicePeriod?.length === 2 && {
        invoicePeriod: {
          startDate: new Date(data.invoicePeriod[0]),
          endDate: new Date(data.invoicePeriod[1]),
        }
      })
    });

    // Generate PDF asynchronously
    generateInvoicePDF(invoice).then(pdfUrl => {
      invoice.pdfUrl = pdfUrl;
      invoice.save();
    }).catch(err => console.error("PDF generation failed:", err.message));

    return res.status(201).json({
      success: true,
      message: "Invoice created successfully.",
      data: invoice,
    });

  } catch (error) {
    console.error("Create invoice error:", error.message);
    
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create invoice",
      error: error.message,
    });
  }
};

// 2. GET ALL INVOICES
const getInvoiceList = async (req, res) => {
  try {
    const query = req.accountType === "admin" ? {} : { createdBy: req.user?._id };
    
    if (!req.accountType !== "admin" && !req.user?._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const invoices = await Invoice.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, total: invoices.length, data: invoices });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. GET INVOICE BY ID
const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    
    if (req.accountType !== "admin" && invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
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
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    if (req.accountType !== "admin" && invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { invoiceNumber, payeeKey, payeeSerialNumber, payee, ...updates } = req.body;
    Object.assign(invoice, updates);

    if (req.body.trips) {
      const result = calculateInvoice(req.body.trips);
      invoice.trips = result.trips;
      invoice.subtotal = result.subtotal;
      invoice.tax = result.tax;
      invoice.grandTotal = result.grandTotal;
    }

    await invoice.save();

    try {
      invoice.pdfUrl = await generateInvoicePDF(invoice);
      await invoice.save();
    } catch (pdfError) {
      console.error("PDF generation failed:", pdfError.message);
    }

    return res.json({ success: true, message: "Invoice updated", data: invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. DELETE INVOICE
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    if (req.accountType !== "admin" && invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    await invoice.deleteOne();
    return res.json({ success: true, message: "Invoice deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. DOWNLOAD PDF
const downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    if (req.accountType !== "admin" && invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const filename = `Invoice-${invoice.invoiceNumber}.pdf`;

    try {
      let pdfUrl = invoice.pdfUrl;

      if (!pdfUrl || !pdfUrl.startsWith("http")) {
        pdfUrl = await generateInvoicePDF(invoice);
        invoice.pdfUrl = pdfUrl;
        await invoice.save();
      }

      const axios = require("axios");
      const response = await axios.get(pdfUrl, { responseType: "stream" });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      response.data.pipe(res);
    } catch (downloadError) {
      if (invoice.pdfUrl) {
        return res.json({ success: true, pdfUrl: invoice.pdfUrl, filename });
      }
      throw downloadError;
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 7. UPDATE STATUS
const updateInvoiceStatus = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { invoiceStatus } = req.body;

    if (!invoiceStatus) {
      return res.status(400).json({ success: false, message: "invoiceStatus is required" });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    if (req.accountType !== "admin" && invoice.createdBy?.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    invoice.invoiceStatus = invoiceStatus.toLowerCase();
    await invoice.save();

    return res.json({ success: true, message: "Status updated", data: invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
