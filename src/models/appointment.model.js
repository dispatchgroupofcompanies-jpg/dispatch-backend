const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    // Trip Info
    tripNumber: {
      type: String,
      trim: true,
    },
    loadConfirmationNumber: {
      type: String,
      trim: true,
    },
    shipmentNumber: {
      type: String,
      trim: true,
    },

    // Carrier Information
    carrierName: {
      type: String,
      trim: true,
    },
    carrierAddress: {
      type: String,
      trim: true,
    },
    carrierPhone: {
      type: String,
      trim: true,
    },
    carrierEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    equipmentType: {
      type: String,
      trim: true,
    },

    // Shipment Schedule
    pickupDate: {
      type: Date,
    },
    pickupTimeStart: {
      type: String,
      trim: true,
    },
    pickupTimeEnd: {
      type: String,
      trim: true,
    },
    deliveryDate: {
      type: Date,
    },
    deliveryTime: {
      type: String,
      trim: true,
    },
    pickupNumber: {
      type: String,
      trim: true,
    },
    dropOffNumber: {
      type: String,
      trim: true,
    },
    commodityDescription: {
      type: String,
      trim: true,
    },
    weight: {
      type: Number,
    },

    // Shipper (Origin)
    shipperName: {
      type: String,
      trim: true,
    },
    shipperAddress: {
      type: String,
      trim: true,
    },
    shipperCity: {
      type: String,
      trim: true,
    },
    shipperProvince: {
      type: String,
      trim: true,
    },
    shipperPostalCode: {
      type: String,
      trim: true,
    },

    // Consignee (Destination)
    consigneeName: {
      type: String,
      trim: true,
    },
    consigneeAddress: {
      type: String,
      trim: true,
    },
    consigneeCity: {
      type: String,
      trim: true,
    },
    consigneeProvince: {
      type: String,
      trim: true,
    },
    consigneePostalCode: {
      type: String,
      trim: true,
    },

    // Charges
    chargeDescription: {
      type: String,
      trim: true,
    },
    rateAmount: {
      type: Number,
    },
    totalAmount: {
      type: Number,
    },
    currency: {
      type: String,
      trim: true,
      default: "CAD",
      uppercase: true,
    },

    // Confirmation
    signature: {
      type: String,
      trim: true,
    },
    signatureDate: {
      type: Date,
    },
    carrierProNumber: {
      type: String,
      trim: true,
    },
    driverCellNumber: {
      type: String,
      trim: true,
    },

    // Notes/Terms
    notesTerms: {
      type: String,
      trim: true,
    },

    // Company Info (kept for backward compatibility)
    companyId: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    addressLine1: {
      type: String,
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    province: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    postCode: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    nsc: {
      type: String,
      trim: true,
    },
    ifta: {
      type: String,
      trim: true,
    },
    gstHst: {
      type: String,
      trim: true,
    },
    qst: {
      type: String,
      trim: true,
    },
    eTransfer: {
      type: String,
      trim: true,
    },
    companyLogo: {
      type: String,
      trim: true,
    },

    // Legacy fields
    appointmentDate: {
      type: Date,
    },
    appointmentTime: {
      type: String,
    },
    serviceType: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },

    // User reference for data isolation
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional for backward compatibility
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
      lowercase: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Appointment", appointmentSchema);