const LoadBoard = require("../../models/loadboard.model");

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
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error("Error fetching load board records:", error);
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
    }).sort({ createdAt: -1 });

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
    const recordData = {
      ...req.body,
      createdBy: userId,
    };
    
    if (recordData.date && typeof recordData.date === 'string') {
      recordData.date = new Date(recordData.date);
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
    const updateData = { ...req.body };
    if (updateData.date && typeof updateData.date === 'string') {
      updateData.date = new Date(updateData.date);
    }

    const record = await LoadBoard.findOneAndUpdate(
      { _id: id, createdBy: userId },
      updateData,
      { new: true, runValidators: true }
    );

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