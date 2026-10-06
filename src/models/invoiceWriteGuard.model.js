const mongoose = require("mongoose");

// A separate coordination document; existing invoice records need no migration.
const schema = new mongoose.Schema({
  _id: String,
  revision: { type: Number, default: 0 },
}, { versionKey: false });

module.exports = mongoose.model("InvoiceWriteGuard", schema);
