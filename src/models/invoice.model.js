const mongoose = require("mongoose");

/**
 * -----------------------
 * TRIP SCHEMA
 * -----------------------
 */
const tripSchema = new mongoose.Schema(
  {
    tripDate: {
      type: Date,
    },

    vrid: {
      type: String,
      trim: true,
    },

    loadId1: {
      type: String,
      trim: true,
    },

    loadId2: {
      type: String,
      trim: true,
    },

    driverName: {
      type: String,
      trim: true,
    },

    route: {
      type: String,
      trim: true,
    },

    pickup: {
      type: String,
      trim: true,
    },

    drop: {
      type: String,
      trim: true,
    },

    totalCharges: {
      type: Number,
      default: 0,
    },

    dispatchPercent: {
      type: Number,
      default: 10,
    },

    dispatchPercentage: {
      type: Number,
      default: 10,
    },

    dispatchAmount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

/**
 * -----------------------
 * INVOICE SCHEMA
 * -----------------------
 */
const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
    },

    payeeKey: {
      type: String,
      index: true,
    },

    payeeSerialNumber: {
      type: Number,
    },

    invoiceType: {
      type: String,
      default: "single",
    },

    invoiceStatus: {
      type: String,
      default: "draft",
      lowercase: true,
    },

    currency: {
      type: String,
      default: "CAD",
    },

    transitNumber: String,
    institutionNumber: String,
    accountNumber: String,

    payee: {
      companyName: String,
      contactPerson: String,
      address1: String,
      address: String,
      phone: String,
      email: String,
      gstNumber: String,
      eTransferAddress: String,
      payeeSelectKey: String,
    },

    customer: {
      customerName: String,
      companyName: String,
      contactPerson: String,
      address1: String,
      phone: String,
      email: String,
      gstNumber: String,
      eTransfer: String,
    },

    trips: [tripSchema],

    subtotal: {
      type: Number,
      default: 0,
    },

    tax: {
      type: Number,
      default: 0,
    },

    grandTotal: {
      type: Number,
      default: 0,
    },

    pdfUrl: String,

    emailStatus: {
      type: String,
      default: "pending",
      lowercase: true,
    },

    emailSentAt: Date,

    notes: String,

    invoiceDate: Date,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Invoice", invoiceSchema);