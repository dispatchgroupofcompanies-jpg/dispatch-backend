const pdf = require("html-pdf-node");
const axios = require("axios");
const { uploadPDFBufferToCloudinary } = require("./cloudinary.service");

// Configure Puppeteer to use system-installed Chromium
const puppeteer = require("puppeteer");

// Set Chromium executable path for Linux VPS
const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || 
                     (process.platform === "linux" ? "/usr/bin/chromium-browser" : null) ||
                     (process.platform === "linux" ? "/snap/bin/chromium" : null);

if (chromiumPath && !process.env.PUPPETEER_EXECUTABLE_PATH) {
  process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath;
  console.log("🔧 Appointment PDF Service: Using system Chromium at:", chromiumPath);
}

const generateAppointmentPDF = async (appointment) => {
  const fileName = `appointment-${appointment._id}.pdf`;

  try {
    // Get HTML template from frontend API (single source of truth)
    const frontendUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3000';
    const response = await axios.post(`${frontendUrl}/api/generate-appointment-html`, appointment);
    
    if (!response.data.success) {
      throw new Error("Failed to generate appointment HTML from frontend");
    }
    
    const html = response.data.html;

    const file = { content: html };
    const options = {
      format: "A4",
      printBackground: true,
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

    console.log("🚀 Generating Appointment PDF...");
    console.log("   Chromium path:", process.env.PUPPETEER_EXECUTABLE_PATH || "default (bundled)");
    const pdfBuffer = await pdf.generatePdf(file, options);
    console.log("✅ Appointment PDF generated (in memory buffer)");

    // Upload directly to Cloudinary from buffer (NO local file saved)
    try {
      const cloudinaryUrl = await uploadPDFBufferToCloudinary(pdfBuffer, fileName, "appointments");
      console.log("✅ Appointment PDF UPLOADED TO CLOUDINARY:", cloudinaryUrl);
      return cloudinaryUrl;
    } catch (uploadError) {
      console.error("❌ Cloudinary upload failed:", uploadError.message);
      throw new Error(`Failed to upload appointment PDF to Cloudinary: ${uploadError.message}`);
    }
  } catch (error) {
    console.error("❌ Error in generateAppointmentPDF:", error);
    throw error;
  }
};

module.exports = generateAppointmentPDF;