const pdf = require("html-pdf-node");
const { uploadPDFBufferToCloudinary } = require("./cloudinary.service");
const { generateInvoicePdfHtml } = require("./pdf-template.service");

// Configure Puppeteer to use system-installed Chromium (optimized for VPS)
const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || 
                     (process.platform === "linux" ? "/usr/bin/chromium-browser" : null) ||
                     (process.platform === "linux" ? "/snap/bin/chromium" : null);

if (chromiumPath && !process.env.PUPPETEER_EXECUTABLE_PATH) {
  process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath;
}

// PDF generation options (pre-configured for performance)
const PDF_OPTIONS = {
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  launchOptions: {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  },
};

const generateInvoicePDF = async (invoice) => {
  if (!invoice || !invoice.invoiceNumber) {
    throw new Error("Invalid invoice data");
  }

  const fileName = `invoice-${invoice.invoiceNumber}.pdf`;

  try {
    const html = generateInvoicePdfHtml(invoice);
    const pdfBuffer = await pdf.generatePdf({ content: html }, PDF_OPTIONS);

    const cloudinaryUrl = await uploadPDFBufferToCloudinary(pdfBuffer, fileName, "invoices");
    return cloudinaryUrl;
  } catch (error) {
    console.error(`❌ PDF generation failed for invoice ${invoice.invoiceNumber}:`, error.message);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
};

module.exports = generateInvoicePDF;
