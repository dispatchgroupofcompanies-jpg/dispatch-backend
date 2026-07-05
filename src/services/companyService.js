const CompanyProfile = require("../models/CompanyProfile.js");

const getCompanyProfileService = async (userId = null, isAdmin = false) => {
  if (isAdmin) {
    return await CompanyProfile.find({}); 
  }
  if (userId) {
    return await CompanyProfile.find({ userId }); 
  }
  return await CompanyProfile.find({}); 
};

const saveOrUpdateProfileService = async (profileData, userId = null) => {
  if (profileData._id) {
    return await CompanyProfile.findByIdAndUpdate(
      profileData._id,
      { $set: profileData },
      { new: true, runValidators: true }
    );
  }

  // Add userId if provided
  if (userId && !profileData.userId) {
    profileData.userId = userId;
  }

  return await CompanyProfile.create(profileData);
};

const deleteProfileService = async (id, isAdmin = false) => {
  if (id) {
    return await CompanyProfile.findByIdAndDelete(id);
  }
  // Only allow delete many for admin
  if (isAdmin) {
    return await CompanyProfile.deleteMany({});
  }
  return { message: "Unauthorized" };
};

module.exports = {
  getCompanyProfileService,
  saveOrUpdateProfileService,
  deleteProfileService
};
