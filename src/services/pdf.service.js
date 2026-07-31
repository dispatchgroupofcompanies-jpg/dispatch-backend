const pdf = require("html-pdf-node");
const { uploadPDFBufferToCloudinary } = require("./cloudinary.service");
const { generateInvoicePdfHtml } = require("./pdf-template.service");
const { getPayeeSerialNumber } = require("./invoiceNumber.service");

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

// Produce the PDF once for authenticated downloads, without relying on the
// access policy of a subsequently delivered Cloudinary raw asset.
const generateInvoicePdfBuffer = async (invoice) => {
  if (!invoice || !invoice.invoiceNumber) {
    throw new Error("Invalid invoice data");
  }

  const payeeSerialNumber = await getPayeeSerialNumber(invoice);
  const invoiceForTemplate = invoice.toObject
    ? invoice.toObject()
    : { ...invoice };
  invoiceForTemplate.payeeSerialNumber = payeeSerialNumber;
  const html = generateInvoicePdfHtml(invoiceForTemplate);
  return pdf.generatePdf({ content: html }, PDF_OPTIONS);
};

const generateInvoicePDF = async (invoice) => {
  if (!invoice || !invoice.invoiceNumber) {
    throw new Error("Invalid invoice data");
  }

  // Serial numbers repeat across payees, so storage names must include the
  // document id to avoid one payee's PDF overwriting another's.
  const fileName = `invoice-${invoice._id}-${invoice.payeeSerialNumber || invoice.invoiceNumber}.pdf`;

  try {
    const payeeSerialNumber = await getPayeeSerialNumber(invoice);
    const invoiceForTemplate = invoice.toObject ? invoice.toObject() : { ...invoice };
    invoiceForTemplate.payeeSerialNumber = payeeSerialNumber;
    const html = generateInvoicePdfHtml(invoiceForTemplate);
    const pdfBuffer = await pdf.generatePdf({ content: html }, PDF_OPTIONS);

    const cloudinaryUrl = await uploadPDFBufferToCloudinary(pdfBuffer, fileName, "invoices");
    return cloudinaryUrl;
  } catch (error) {
    console.error(`❌ PDF generation failed for invoice ${invoice.invoiceNumber}:`, error.message);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
};

module.exports = generateInvoicePDF;
module.exports.generateInvoicePdfBuffer = generateInvoicePdfBuffer;
