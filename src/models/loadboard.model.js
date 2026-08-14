const mongoose = require("mongoose");

const loadBoardSchema = new mongoose.Schema(
  {
    carrierName: {
      type: String,
      required: [true, "Carrier name is required"],
      trim: true,
    },
    thirdPartyCarrierName: {
      type: String,
      required: [true, "3P Carrier name is required"],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    mgCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    load1Id: {
      type: String,
      trim: true,
    },
    vrid: {
      type: String,
      trim: true,
    },
    legs: {
      type: Number,
      min: 1,
      max: 2,
      default: 1,
    },
    pickupTime: {
      type: String,
      default: "",
    },
    deliveryTime: {
      type: String,
      default: "",
    },
    tripCharges: {
      type: Number,
      required: [true, "Trip charges are required"],
      min: 0,
    },
    dispatcher: {
      type: String,
      required: [true, "Dispatcher is required"],
      trim: true,
    },
    driverName: {
      type: String,
      required: [true, "Payment ID is required"],
      trim: true,
    },
    dispatchCharges: {
      type: Number,
      min: 0,
    },
    tonu: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
    },
    invoiceStatus: {
      type: String,
      enum: ["generated", "pending"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "pending"],
      default: "pending",
    },
    screenshotUrl: {
      type: String,
      default: "",
    },
    screenshotPublicId: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    loads: [
      {
        vrid: {
          type: String,
          required: true,
          trim: true,
        },
        load1Id: {
          type: String,
          required: true,
          trim: true,
        },
        load2Id: {
          type: String,
          trim: true,
        },
        tripCharges: {
          type: Number,
          required: true,
          min: 0,
        },
        dispatcher: {
          type: String,
          required: true,
          trim: true,
        },
        driverName: {
          type: String,
          required: true,
          trim: true,
        },
        dispatchCharges: {
          type: Number,
          required: true,
          min: 0,
        },
        tonu: {
          type: Boolean,
          default: false,
        },
        date: {
          type: String,
          required: true,
        },
        mgCharges: {
          type: Number,
          required: true,
          min: 0,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Add indexes for optimization
loadBoardSchema.index({ createdBy: 1, createdAt: -1 });
loadBoardSchema.index({ createdBy: 1, invoiceStatus: 1, paymentStatus: 1, createdAt: -1 });
loadBoardSchema.index({ status: 1 });
loadBoardSchema.index({ date: -1 });

module.exports = mongoose.model("LoadBoard", loadBoardSchema);
