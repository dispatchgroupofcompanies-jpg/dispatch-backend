const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");
const os = require("os");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload PDF buffer to Cloudinary (no local file saved)
 * @param {Buffer} pdfBuffer - PDF buffer
 * @param {string} fileName - File name (e.g., 'invoice-INV-000001.pdf')
 * @param {string} folder - Cloudinary folder (e.g., 'invoices' or 'appointments')
 * @returns {Promise<string>} - Cloudinary URL
 */
const uploadPDFBufferToCloudinary = async (pdfBuffer, fileName, folder = "invoices") => {
  try {
    // Raw Cloudinary assets must include their extension in the public ID.
    // This keeps the delivered link and downloaded file recognizably as a PDF.
    const publicId = path.basename(fileName);
    
    // Use upload_stream for buffer upload
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: `dispatch/${folder}`,
          public_id: publicId,
          filename_override: fileName,
          overwrite: true,
          access_mode: "public",
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      
      uploadStream.end(pdfBuffer);
    });

    console.log(`✅ PDF uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error("❌ Cloudinary upload failed:", error.message);
    throw error;
  }
};

/**
 * Legacy function for backward compatibility
 * Upload PDF to Cloudinary and delete local file
 * @param {string} localFilePath - Local file path
 * @param {string} folder - Cloudinary folder (e.g., 'invoices' or 'appointments')
 * @returns {Promise<string>} - Cloudinary URL
 */
const uploadPDFToCloudinary = async (localFilePath, folder = "invoices") => {
  try {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`File not found: ${localFilePath}`);
    }

    const result = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "raw",
      folder: `dispatch/${folder}`,
      public_id: path.basename(localFilePath),
      filename_override: path.basename(localFilePath),
      overwrite: true,
      access_mode: "public",
    });

    console.log(`✅ PDF uploaded to Cloudinary: ${result.secure_url}`);
    
    // Delete local file after successful upload
    try {
      fs.unlinkSync(localFilePath);
      console.log(`🗑️ Local file deleted: ${localFilePath}`);
    } catch (deleteErr) {
      console.warn(`⚠️ Could not delete local file: ${deleteErr.message}`);
    }

    return result.secure_url;
  } catch (error) {
    console.error("❌ Cloudinary upload failed:", error.message);
    throw error;
  }
};

/**
 * Delete PDF from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<object>} - Deletion result
 */
const deletePDFFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "auto",
    });
    console.log(`🗑️ PDF deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    console.error("❌ Cloudinary deletion failed:", error.message);
    throw error;
  }
};

module.exports = {
  uploadPDFBufferToCloudinary,
  uploadPDFToCloudinary,
  deletePDFFromCloudinary,
  cloudinary,
};
