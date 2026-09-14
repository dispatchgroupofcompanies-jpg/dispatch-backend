const puppeteer = require("puppeteer");
const { uploadPDFBufferToCloudinary } = require("./cloudinary.service");
const { generateInvoicePdfHtml } = require("./pdf-template.service");
const { getPayeeSerialNumber } = require("./invoiceNumber.service");

// PDF generation options
const PDF_OPTIONS = {
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
};

const renderPdf = async (html) => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return Buffer.from(await page.pdf(PDF_OPTIONS));
  } finally {
    await browser.close();
  }
};

// Produce the PDF once for authenticated downloads, without relying on the
// access policy of a subsequently delivered Cloudinary raw asset.
const generateInvoicePdfBuffer = async (invoice, options = {}) => {
  if (!invoice || !invoice.invoiceNumber) {
    throw new Error("Invalid invoice data");
  }

  const payeeSerialNumber = await getPayeeSerialNumber(invoice);
  const invoiceForTemplate = invoice.toObject
    ? invoice.toObject()
    : { ...invoice };
  invoiceForTemplate.payeeSerialNumber = payeeSerialNumber;
  const html = generateInvoicePdfHtml(invoiceForTemplate, options);
  return renderPdf(html);
};

const generateInvoicePDF = async (invoice, options = {}) => {
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
    const html = generateInvoicePdfHtml(invoiceForTemplate, options);
    const pdfBuffer = await renderPdf(html);

    const cloudinaryUrl = await uploadPDFBufferToCloudinary(pdfBuffer, fileName, "invoices");
    return cloudinaryUrl;
  } catch (error) {
    console.error(`❌ PDF generation failed for invoice ${invoice.invoiceNumber}:`, error.message);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
};

module.exports = generateInvoicePDF;
module.exports.generateInvoicePdfBuffer = generateInvoicePdfBuffer;
