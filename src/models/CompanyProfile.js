const mongoose = require("mongoose");

const CompanyProfileSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    carrierIdentifier: { type: String, required: true, trim: true },
    province: { type: String, required: true },
    nsc: { type: String, required: true, trim: true },
    gstHst: { type: String, required: true, trim: true },
    qst: { type: String, trim: true },
    institutionNumber: { type: String, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    eTransfer: { type: String, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    countryCode: { type: String, required: true, default: "+1" },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: "CA" },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.CompanyProfile || 
  mongoose.model("CompanyProfile", CompanyProfileSchema);
