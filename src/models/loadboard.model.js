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
    vrid: {
      type: String,
      required: [true, "VRID is required"],
      trim: true,
    },
    legs: {
      type: Number,
      required: [true, "Legs is required"],
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
      required: [true, "Dispatcher name is required"],
      trim: true,
    },
    driverName: {
      type: String,
      required: [true, "Driver name is required"],
      trim: true,
    },
    dispatchCharges: {
      type: Number,
      required: [true, "Dispatch charges are required"],
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("LoadBoard", loadBoardSchema);