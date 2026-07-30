require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const mongoose = require("mongoose");
const Invoice = require("./src/models/invoice.model");
const Counter = require("./src/models/Counter");
const { getPayeeKey } = require("./src/services/invoiceNumber.service");

const migratePayeeInvoiceSerials = async () => {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/dispatch_db");

  try {
    // The legacy global unique index must be removed before two payees can both
    // use invoice number 1.
    const indexes = await Invoice.collection.indexes();
    if (indexes.some((index) => index.name === "invoiceNumber_1")) {
      await Invoice.collection.dropIndex("invoiceNumber_1");
      console.log("Removed legacy global invoiceNumber index.");
    }

    const invoices = await Invoice.find({}).sort({ createdAt: 1, _id: 1 });
    const sequences = new Map();

    for (const invoice of invoices) {
      let payeeKey;
      try {
        payeeKey = getPayeeKey(invoice.payee);
      } catch {
        // Legacy records without a payee remain addressable and get a shared
        // legacy sequence rather than preventing the migration from finishing.
        payeeKey = "legacy-unknown-payee";
      }

      const serialNumber = (sequences.get(payeeKey) || 0) + 1;
      sequences.set(payeeKey, serialNumber);

      invoice.payeeKey = payeeKey;
      invoice.payeeSerialNumber = serialNumber;
      invoice.invoiceNumber = String(serialNumber);
      await invoice.save();
    }

    await Counter.deleteMany({ name: { $regex: /^invoice(?::|$)/ } });
    await Counter.insertMany(
      [...sequences.entries()].map(([payeeKey, sequence]) => ({
        name: `invoice:${payeeKey}`,
        sequence,
      })),
    );

    await Invoice.syncIndexes();
    console.log(`Migrated ${invoices.length} invoices across ${sequences.size} payees.`);
  } finally {
    await mongoose.disconnect();
  }
};

migratePayeeInvoiceSerials().catch((error) => {
  console.error("Payee invoice serial migration failed:", error);
  process.exitCode = 1;
});
