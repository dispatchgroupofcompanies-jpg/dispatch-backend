require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const Invoice = require('./src/models/invoice.model');
const Counter = require('./src/models/Counter');

const migrateInvoiceNumbers = async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dispatch_db');

  try {
    const invoices = await Invoice.find({}).sort({ createdAt: 1, _id: 1 });
    console.log(`Found ${invoices.length} invoices to migrate`);

    const payeeSequences = new Map();
    const tempPrefix = `TMP-${Date.now()}-`;

    // First pass: assign temporary unique invoice numbers to avoid unique index conflicts
    for (let index = 0; index < invoices.length; index++) {
      const invoice = invoices[index];
      invoice.invoiceNumber = `${tempPrefix}${index + 1}`;
      await invoice.save();
    }

    // Second pass: assign final sequential invoice numbers and payee serials
    for (let index = 0; index < invoices.length; index++) {
      const invoice = invoices[index];
      const rawPayeeKey = invoice.payee?.payeeSelectKey || invoice.payee?.companyName || 'legacy-unknown-payee';
      const payeeKey = String(rawPayeeKey).trim().toLocaleLowerCase().replace(/\s+/g, ' ');
      const serialNumber = (payeeSequences.get(payeeKey) || 0) + 1;
      payeeSequences.set(payeeKey, serialNumber);

      invoice.payeeKey = payeeKey;
      invoice.payeeSerialNumber = serialNumber;
      invoice.invoiceNumber = String(index + 1);
      await invoice.save();
      console.log(`Renumbered invoice ${invoice._id}: ${invoice.invoiceNumber}, payeeKey=${payeeKey}, payeeSerialNumber=${serialNumber}`);
    }

    await Counter.updateOne(
      { name: 'invoice' },
      { $set: { sequence: invoices.length } },
      { upsert: true },
    );

    await Invoice.syncIndexes();
    console.log(`Migrated ${invoices.length} invoices sequentially.`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

migrateInvoiceNumbers();