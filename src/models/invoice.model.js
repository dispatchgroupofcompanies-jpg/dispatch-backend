const mongoose = require("mongoose");
const crypto = require("crypto");

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
      required: true,
      unique: true,
      index: true,
    },

    payeeKey: {
      type: String,
      index: true,
    },

    payeeSerialNumber: {
      type: Number,
      default: 1,
    },

    invoiceType: {
      type: String,
      default: "single",
    },

    invoiceStatus: {
      type: String,
      default: "draft",
      lowercase: true,
      enum: ["draft", "pending", "approved", "rejected", "paid", "cancelled"],
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

    paymentStatus: {
      type: String,
      default: "pending",
      lowercase: true,
      enum: ["pending", "paid"],
    },

    paymentProofUrl: String,

    paymentProofPublicId: String,

    paidAt: Date,

    shareToken: {

      type: String,
      unique: true,
      sparse: true,
      default: () => crypto.randomBytes(32).toString("hex"),
    },

    shareExpiresAt: Date,

    emailStatus: {
      type: String,
      default: "pending",
      lowercase: true,
      enum: ["pending", "sent", "failed"],
    },

    emailSentAt: Date,

    notes: String,

    invoiceDate: Date,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    invoicePeriod: {
      startDate: Date,
      endDate: Date,
    },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.index({ createdBy: 1, createdAt: -1 });
invoiceSchema.index({ payeeKey: 1, payeeSerialNumber: 1 });

module.exports = mongoose.model("Invoice", invoiceSchema);
