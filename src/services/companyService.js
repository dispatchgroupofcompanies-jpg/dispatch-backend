const CompanyProfile = require("../models/CompanyProfile.js");

const getCompanyProfileService = async (userId = null, isAdmin = false) => {
  // Profiles are shared reference data used by the invoice payee/customer
  // selectors. Authorization is enforced for writes and deletes below.
  return CompanyProfile.find({});
};

const saveOrUpdateProfileService = async (profileData, userId = null, isAdmin = false) => {
  const { _id, userId: suppliedUserId, ...safeProfileData } = profileData;
  if (profileData._id) {
    return CompanyProfile.findOneAndUpdate(
      isAdmin ? { _id } : { _id, userId },
      { $set: safeProfileData },
      { returnDocument: "after", runValidators: true }
    );
  }

  return CompanyProfile.create({ ...safeProfileData, userId: isAdmin ? suppliedUserId || userId : userId });
};

const deleteProfileService = async (id, userId = null, isAdmin = false) => {
  if (id) {
    return CompanyProfile.findOneAndDelete(isAdmin ? { _id: id } : { _id: id, userId });
  }
  // Only allow delete many for admin
  if (isAdmin) {
    return await CompanyProfile.deleteMany({});
  }
  return null;
};

module.exports = {
  getCompanyProfileService,
  saveOrUpdateProfileService,
  deleteProfileService
};
