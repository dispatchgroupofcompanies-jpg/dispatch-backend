const pdf = require("html-pdf-node");
const { uploadPDFBufferToCloudinary } = require("./cloudinary.service");

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

const generateAppointmentPDF = async (appointment) => {
  if (!appointment || !appointment._id) {
    throw new Error("Invalid appointment data");
  }

  const fileName = `appointment-${appointment._id}.pdf`;

  try {
    // Get HTML template from frontend API (single source of truth)
    const frontendUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3000';
    
    const axios = require("axios");
    const response = await axios.post(`${frontendUrl}/api/generate-appointment-html`, appointment);
    
    if (!response.data?.success || !response.data?.html) {
      throw new Error("Failed to generate appointment HTML from frontend");
    }

    const pdfBuffer = await pdf.generatePdf({ content: response.data.html }, PDF_OPTIONS);
    const cloudinaryUrl = await uploadPDFBufferToCloudinary(pdfBuffer, fileName, "appointments");
    return cloudinaryUrl;
  } catch (error) {
    console.error(`❌ Appointment PDF generation failed for ${appointment._id}:`, error.message);
    throw new Error(`Appointment PDF generation failed: ${error.message}`);
  }
};

module.exports = generateAppointmentPDF;
