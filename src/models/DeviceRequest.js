const mongoose = require("mongoose");

const deviceRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: false,
    },
    ip: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    decidedAt: {
      type: Date,
      required: false,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    lastSeenAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate device requests per user
deviceRequestSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

// Index for faster queries
deviceRequestSchema.index({ userId: 1, status: 1 });
deviceRequestSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model("DeviceRequest", deviceRequestSchema);