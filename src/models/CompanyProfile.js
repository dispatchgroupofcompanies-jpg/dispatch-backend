import mongoose from "mongoose";

const CompanyProfileSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    carrierIdentifier: { type: String, required: true, trim: true },
    eTransfer: { type: String, required: true, trim: true, lowercase: true },
    province: { type: String, required: true },
    nsc: { type: String, required: true, trim: true },
    gstHst: { type: String, required: true, trim: true },
    qst: { type: String, trim: true },
    // ifta: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    countryCode: { type: String, required: true, default: "+1" },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: "CA" },
  },
  { timestamps: true }
);

export default mongoose.models.CompanyProfile || 
  mongoose.model("CompanyProfile", CompanyProfileSchema);