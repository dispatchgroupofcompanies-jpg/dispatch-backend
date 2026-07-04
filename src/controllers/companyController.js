import { 
  getCompanyProfileService, 
  saveOrUpdateProfileService, 
  deleteProfileService 
} from "../services/companyService.js";

export const getProfile = async (req, res) => {
  try {
    const profiles = await getCompanyProfileService();
    return res.status(200).json({ success: true, data: profiles });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const saveProfile = async (req, res) => {
  try {
    const data = req.body;
    
    const updatedProfile = await saveOrUpdateProfileService(data);

    return res.status(200).json({ success: true, data: updatedProfile });
  } catch (error) {
    console.error("❌ ERROR IN SAVE_PROFILE CONTROLLER:", error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const clearProfile = async (req, res) => {
  try {
    const { id } = req.query; 
    await deleteProfileService(id);
    return res.status(200).json({ success: true, message: "Profile cleared successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};