import CompanyProfile from "../models/CompanyProfile.js";

export const getCompanyProfileService = async () => {
  return await CompanyProfile.find({}); 
};

export const saveOrUpdateProfileService = async (profileData) => {
  if (profileData._id) {
    return await CompanyProfile.findByIdAndUpdate(
      profileData._id,
      { $set: profileData },
      { new: true, runValidators: true }
    );
  }

  return await CompanyProfile.create(profileData);
};

export const deleteProfileService = async (id) => {
  if (id) {
    return await CompanyProfile.findByIdAndDelete(id);
  }
  return await CompanyProfile.deleteMany({});
};