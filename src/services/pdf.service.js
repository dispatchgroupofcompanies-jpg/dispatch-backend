const pdf = require("html-pdf-node");
const axios = require("axios");
const { uploadPDFBufferToCloudinary } = require("./cloudinary.service");
const { generateInvoicePdfHtml } = require("./pdf-template.service");

// Configure Puppeteer to use system-installed Chromium
const puppeteer = require("puppeteer");
const path = require("path");

// Set Chromium executable path for Linux VPS
const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || 
                     (process.platform === "linux" ? "/usr/bin/chromium-browser" : null) ||
                     (process.platform === "linux" ? "/snap/bin/chromium" : null);

if (chromiumPath && !process.env.PUPPETEER_EXECUTABLE_PATH) {
  process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath;
  console.log("🔧 PDF Service: Using system Chromium at:", chromiumPath);
}

const generateInvoicePDF = async (invoice) => {
  const fileName = `invoice-${invoice.invoiceNumber}.pdf`;

  try {
    // Generate HTML template directly in backend (no frontend dependency)
    const html = generateInvoicePdfHtml(invoice);

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
      // Pass Puppeteer launch arguments for Linux VPS
      launchOptions: {
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      },
    };

    console.log("🚀 Rendering Professional Layout Template with Watermark...");
    console.log("   Chromium path:", process.env.PUPPETEER_EXECUTABLE_PATH || "default (bundled)");
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
