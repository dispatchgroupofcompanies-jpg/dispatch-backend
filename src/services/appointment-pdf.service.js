const { renderPdf } = require("./pdf/render.service");
const { uploadPDFBufferToCloudinary } = require("./cloudinary.service");

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

    const pdfBuffer = await renderPdf(response.data.html);
    const cloudinaryUrl = await uploadPDFBufferToCloudinary(pdfBuffer, fileName, "appointments");
    return cloudinaryUrl;
  } catch (error) {
    console.error(`❌ Appointment PDF generation failed for ${appointment._id}:`, error.message);
    throw new Error(`Appointment PDF generation failed: ${error.message}`);
  }
};

module.exports = generateAppointmentPDF;
