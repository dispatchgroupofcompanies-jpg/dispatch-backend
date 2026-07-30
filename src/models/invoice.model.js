const mongoose = require("mongoose");

/**
 * -----------------------
 * TRIP SCHEMA
 * -----------------------
 */
const tripSchema = new mongoose.Schema(
  {
    tripDate: { type: Date, required: true },
    // Trip and load identifiers may contain any mix of letters, digits and
    // punctuation. Preserve the value exactly as the dispatcher entered it.
    vrid: { type: String, required: true, trim: true },

    loadId1: {
      type: String,
      trim: true,
    },

    loadId2: {
      type: String,
      trim: true,
    },
    
    // Driver Name - always required
    driverName: {
      type: String,
      trim: true,
      required: true,
      validate: {
        validator: function (value) {
          return value && value.trim().length > 0;
        },
        message: "Driver name is required!",
      },
    },
    
    route: { type: String, trim: true },
    pickup: { type: String, trim: true },
    drop: { type: String, trim: true },
    totalCharges: { type: Number, default: 0 },
    dispatchPercent: { type: Number, default: 10 },
    dispatchPercentage: { type: Number, default: 10 },
    dispatchAmount: { type: Number, default: 0 },
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
    // `invoiceNumber` is the customer-facing serial number. It is unique only
    // within the payee that issued the invoice.
    invoiceNumber: { type: String, required: true },
    payeeKey: { type: String, required: true, index: true },
    payeeSerialNumber: { type: Number, required: true },
    invoiceType: {
      type: String,
      enum: ["single", "multiple", "Single", "Multiple"],
      default: "single",
    },

    invoiceStatus: {
      type: String,
      enum: ["draft", "sent", "paid", "cancelled", "approved", "rejected", "pending"],
      default: "draft",
      lowercase: true,
    },

    currency: { type: String, default: "CAD" },
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
      customerName: { type: String, required: false },
      companyName: String,
      contactPerson: String,
      address1: String,
      phone: String,
      email: String,
      gstNumber: String,
      eTransfer: String,
    },

    trips: { type: [tripSchema], required: true },

    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    pdfUrl: { type: String },

    emailStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
      lowercase: true,
    },
    emailSentAt: { type: Date },

    notes: String,
    invoiceDate: { type: Date },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  { timestamps: true }
);

// A payee owns its own invoice sequence, so the same serial can exist for
// different payees but can never be repeated by the same one.
invoiceSchema.index({ payeeKey: 1, payeeSerialNumber: 1 }, { unique: true });

module.exports = mongoose.model("Invoice", invoiceSchema);
