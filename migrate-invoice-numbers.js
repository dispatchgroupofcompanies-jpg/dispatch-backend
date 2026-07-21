require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const Invoice = require('./src/models/invoice.model');
const Counter = require('./src/models/Counter');

const migrateInvoiceNumbers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dispatch_db');
    console.log('Connected to MongoDB');

    // Get all invoices
    const invoices = await Invoice.find({});
    console.log(`Found ${invoices.length} invoices to migrate`);

    let migrated = 0;
    let skipped = 0;

    // Sort invoices by creation date to maintain order
    invoices.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // Renumber all invoices sequentially starting from 1
    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      const newNumber = String(i + 1); // Sequential: 1, 2, 3, 4, 5...
      
      console.log(`Renumbering: ${invoice.invoiceNumber} -> ${newNumber}`);
      invoice.invoiceNumber = newNumber;
      await invoice.save();
      migrated++;
    }

    // Update the counter to be at least as high as the highest invoice number
    const highestNumber = invoices.length;
    const counter = await Counter.findOneAndUpdate(
      { name: 'invoice' },
      { $set: { sequence: highestNumber } },
      { new: true, upsert: true }
    );
    console.log(`\nCounter updated to sequence: ${counter.sequence}`);

    console.log(`\nMigration complete:`);
    console.log(`  - Migrated: ${migrated} invoices`);
    console.log(`  - Skipped (already correct): ${skipped} invoices`);
    console.log(`  - Total: ${invoices.length} invoices`);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

migrateInvoiceNumbers();