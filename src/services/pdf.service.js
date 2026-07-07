const pdf = require("html-pdf-node");
const axios = require("axios");
const { uploadPDFBufferToCloudinary } = require("./cloudinary.service");

const generateInvoicePDF = async (invoice) => {
  const fileName = `invoice-${invoice.invoiceNumber}.pdf`;

  try {
    // Get HTML template from frontend API (single source of truth)
    const frontendUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3000';
    const response = await axios.post(`${frontendUrl}/api/generate-invoice-html`, invoice);
    
    if (!response.data.success) {
      throw new Error("Failed to generate invoice HTML from frontend");
    }
    
    const html = response.data.html;

    const file = { content: html };
    const options = {
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    };

    console.log("🚀 Rendering Professional Layout Template with Watermark...");
    const pdfBuffer = await pdf.generatePdf(file, options);
    console.log("✅ PROFESSIONAL PDF GENERATED (in memory buffer)");

    // Upload directly to Cloudinary from buffer (NO local file saved)
    try {
      const cloudinaryUrl = await uploadPDFBufferToCloudinary(pdfBuffer, fileName, "invoices");
      console.log("✅ PDF UPLOADED TO CLOUDINARY:", cloudinaryUrl);
      return cloudinaryUrl;
    } catch (uploadError) {
      console.error("❌ Cloudinary upload failed:", uploadError.message);
      throw new Error(`Failed to upload PDF to Cloudinary: ${uploadError.message}`);
    }
  } catch (error) {
    console.error("❌ Error in generateInvoicePDF:", error);
    throw error;
  }
};

module.exports = generateInvoicePDF;
