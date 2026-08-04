const LoadBoard = require("../../models/loadboard.model");
const { uploadImageBufferToCloudinary, cloudinary } = require("../../services/cloudinary.service");

const parseRecordBody = (body) => {
  const parsed = { ...body };
  ["mgCharges", "tripCharges", "dispatchCharges", "legs"].forEach((field) => {
    if (parsed[field] !== undefined && parsed[field] !== "") parsed[field] = Number(parsed[field]);
  });
  if (typeof parsed.loads === "string") parsed.loads = JSON.parse(parsed.loads);
  return parsed;
};

const attachScreenshot = async (recordData, file, existingPublicId = "") => {
  if (!file) return recordData;
  const upload = await uploadImageBufferToCloudinary(file.buffer, file.originalname);
  if (existingPublicId) {
    await cloudinary.uploader.destroy(existingPublicId, { resource_type: "image" });
  }
  return { ...recordData, screenshotUrl: upload.secureUrl, screenshotPublicId: upload.publicId };
};

// Get all load board records for the current user
exports.getAllLoadBoardRecords = async (req, res) => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const records = await LoadBoard.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching load board records",
      error: error.message,
    });
  }
};

// Search load board records
exports.searchLoadBoardRecords = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { query } = req.query;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!query || query.trim() === "") {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // Create case-insensitive regex for search
    const searchRegex = new RegExp(query.trim(), 'i');

    const records = await LoadBoard.find({
      createdBy: userId,
      $or: [
        { vrid: searchRegex },
        { load1Id: searchRegex },
        { load2Id: searchRegex },
        { carrierName: searchRegex },
        { thirdPartyCarrierName: searchRegex },
        { dispatcher: searchRegex },
        { driverName: searchRegex }
      ]
    }).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error("Error searching load board records:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Internal server error while searching load board records",
      error: error.message,
    });
  }
};

// Create new load board record
exports.createLoadBoardRecord = async (req, res) => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Convert date string to Date object
    let recordData = {
      ...parseRecordBody(req.body),
      createdBy: userId,
    };
    recordData = await attachScreenshot(recordData, req.file);
    
    if (recordData.date && typeof recordData.date === 'string') {
      recordData.date = new Date(recordData.date);
    }

    // Ensure legs is at least 1
    if (!recordData.legs || recordData.legs < 1) {
      recordData.legs = 1;
    }

    // If loads array exists and has items, sync the main record fields with first load
    if (recordData.loads && recordData.loads.length > 0) {
      const firstLoad = recordData.loads[0];
      recordData.load1Id = firstLoad.load1Id || recordData.load1Id || "";
      recordData.load2Id = firstLoad.load2Id || recordData.load2Id || "";
      recordData.vrid = firstLoad.vrid || recordData.vrid || "";
      recordData.tripCharges = firstLoad.tripCharges || recordData.tripCharges || 0;
      recordData.dispatcher = firstLoad.dispatcher || recordData.dispatcher || "";
      recordData.driverName = firstLoad.driverName || recordData.driverName || "";
      recordData.dispatchCharges = firstLoad.dispatchCharges || recordData.dispatchCharges || 0;
      recordData.tonu = firstLoad.tonu !== undefined ? firstLoad.tonu : recordData.tonu || false;
      if (firstLoad.date && !recordData.date) {
        recordData.date = new Date(firstLoad.date);
      }
      recordData.mgCharges = firstLoad.mgCharges || recordData.mgCharges || 0;
    }

    const record = await LoadBoard.create(recordData);

    res.status(201).json({
      success: true,
      message: "Load board record created successfully",
      data: record,
    });
  } catch (error) {
    console.error("Error creating load board record:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating load board record",
      error: error.message,
    });
  }
};

// Update load board record
exports.updateLoadBoardRecord = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Convert date string to Date object if present
    const existingRecord = await LoadBoard.findOne({ _id: id, createdBy: userId })
      .select("screenshotPublicId")
      .lean();
    if (!existingRecord) {
      return res.status(404).json({ success: false, message: "Load board record not found" });
    }

    let updateData = parseRecordBody(req.body);
    updateData = await attachScreenshot(updateData, req.file, existingRecord.screenshotPublicId);
    if (updateData.date && typeof updateData.date === 'string') {
      updateData.date = new Date(updateData.date);
    }

    // Ensure legs is at least 1
    if (!updateData.legs || updateData.legs < 1) {
      updateData.legs = 1;
    }

    // If loads array exists and has items, sync the main record fields with first load
    if (updateData.loads && updateData.loads.length > 0) {
      const firstLoad = updateData.loads[0];
      updateData.load1Id = firstLoad.load1Id || updateData.load1Id || "";
      updateData.load2Id = firstLoad.load2Id || updateData.load2Id || "";
      updateData.vrid = firstLoad.vrid || updateData.vrid || "";
      updateData.tripCharges = firstLoad.tripCharges || updateData.tripCharges || 0;
      updateData.dispatcher = firstLoad.dispatcher || updateData.dispatcher || "";
      updateData.driverName = firstLoad.driverName || updateData.driverName || "";
      updateData.dispatchCharges = firstLoad.dispatchCharges || updateData.dispatchCharges || 0;
      updateData.tonu = firstLoad.tonu !== undefined ? firstLoad.tonu : updateData.tonu || false;
      if (firstLoad.date && !updateData.date) {
        updateData.date = new Date(firstLoad.date);
      }
      updateData.mgCharges = firstLoad.mgCharges || updateData.mgCharges || 0;
    }

    const record = await LoadBoard.findOneAndUpdate(
      { _id: id, createdBy: userId },
      updateData,
      { returnDocument: "after", runValidators: true }
    ).lean();

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Load board record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Load board record updated successfully",
      data: record,
    });
  } catch (error) {
    console.error("Error updating load board record:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating load board record",
      error: error.message,
    });
  }
};

// Delete load board record
exports.deleteLoadBoardRecord = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const record = await LoadBoard.findOneAndDelete({
      _id: id,
      createdBy: userId,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Load board record not found",
      });
    }

    if (record.screenshotPublicId) {
      await cloudinary.uploader.destroy(record.screenshotPublicId, { resource_type: "image" });
    }

    res.status(200).json({
      success: true,
      message: "Load board record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting load board record:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting load board record",
    });
  }
};
