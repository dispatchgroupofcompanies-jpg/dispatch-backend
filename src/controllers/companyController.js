const { 
  getCompanyProfileService, 
  saveOrUpdateProfileService, 
  deleteProfileService 
} = require("../services/companyService.js");

const getProfile = async (req, res) => {
  try {
    console.log("🔍 getProfile - req.user:", req.user ? "exists" : "undefined");
    console.log("🔍 getProfile - req.accountType:", req.accountType);
    
    const isAdmin = req.accountType === "admin";
    const userId = req.user?._id;
    
    if (!userId && !isAdmin) {
      return res.status(401).json({ 
        success: false, 
        error: "User not authenticated" 
      });
    }
    
    const profiles = await getCompanyProfileService(userId, isAdmin);
    return res.status(200).json({ success: true, data: profiles });
  } catch (error) {
    console.error("Error in getProfile:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const saveProfile = async (req, res) => {
  try {
    console.log("🔍 saveProfile - req.user:", req.user ? "exists" : "undefined");
    console.log("🔍 saveProfile - req.accountType:", req.accountType);
    
    const data = req.body;
    const isAdmin = req.accountType === "admin";
    const userId = req.user?._id;
    
    if (!userId && !isAdmin) {
      return res.status(401).json({ 
        success: false, 
        error: "User not authenticated" 
      });
    }
    
    const updatedProfile = await saveOrUpdateProfileService(data, userId);

    return res.status(200).json({ success: true, data: updatedProfile });
  } catch (error) {
    console.error("❌ ERROR IN SAVE_PROFILE CONTROLLER:", error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

const clearProfile = async (req, res) => {
  try {
    const { id } = req.query; 
    const isAdmin = req.accountType === "admin";
    await deleteProfileService(id, isAdmin);
    return res.status(200).json({ success: true, message: "Profile cleared successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getProfile,
  saveProfile,
  clearProfile
};
