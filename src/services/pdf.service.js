const { renderPdf } = require("./pdf/render.service");
const { uploadPDFBufferToCloudinary } = require("./cloudinary.service");
const { generateInvoicePdfHtml } = require("./pdf-template.service");
const { getPayeeSerialNumber } = require("./invoiceNumber.service");

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
    const pdfBuffer = await generateInvoicePdfBuffer(invoice, options);

    const cloudinaryUrl = await uploadPDFBufferToCloudinary(pdfBuffer, fileName, "invoices");
    return cloudinaryUrl;
  } catch (error) {
    console.error(`❌ PDF generation failed for invoice ${invoice.invoiceNumber}:`, error.message);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
};

module.exports = generateInvoicePDF;
module.exports.generateInvoicePdfBuffer = generateInvoicePdfBuffer;
