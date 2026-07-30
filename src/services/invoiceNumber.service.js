const Counter = require("../models/Counter");
const Invoice = require("../models/invoice.model");

const getPayeeKey = (payee = {}) => {
  const identifier = payee.payeeSelectKey || payee.companyName;

  if (!identifier || !String(identifier).trim()) {
    throw new Error("A payee company is required to generate an invoice number.");
  }

  return String(identifier)
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
};

const getPayeeQuery = (invoice) => {
  const payeeKey = getPayeeKey(invoice.payee);
  const payeeQueries = [{ payeeKey }];

  if (invoice.payee?.payeeSelectKey) {
    payeeQueries.push({ "payee.payeeSelectKey": invoice.payee.payeeSelectKey });
  }
  if (invoice.payee?.companyName) {
    payeeQueries.push({ "payee.companyName": invoice.payee.companyName });
  }

  return { payeeKey, payeeQueries };
};

// Used while rendering legacy invoices too. This deliberately derives the
// sequence from creation order so old global numbers never leak into a PDF or
// email while the migration is being rolled out.
const getPayeeSerialNumber = async (invoice) => {
  if (!invoice?.createdAt) return invoice?.payeeSerialNumber || 1;

  const { payeeQueries } = getPayeeQuery(invoice);
  return Invoice.countDocuments({
    $and: [
      { $or: payeeQueries },
      {
        $or: [
          { createdAt: { $lt: new Date(invoice.createdAt) } },
          { createdAt: new Date(invoice.createdAt), _id: { $lte: invoice._id } },
        ],
      },
    ],
  });
};

const generateInvoiceNumber = async (payee) => {
  const payeeKey = getPayeeKey(payee);
  const counterName = `invoice:${payeeKey}`;

  // The count makes deployment safe for existing, pre-migration invoices.
  // New counters are still incremented atomically by MongoDB.
  const { payeeQueries } = getPayeeQuery({ payee });
  const existingInvoices = await Invoice.countDocuments({ $or: payeeQueries });

  await Counter.findOneAndUpdate(
    { name: counterName },
    { $setOnInsert: { sequence: existingInvoices } },
    { new: true, upsert: true },
  );

  const counter = await Counter.findOneAndUpdate(
    {
      name: counterName,
    },
    {
      $inc: {
        sequence: 1,
      },
    },
    {
      new: true,
      upsert: true,
    }
  );

  return {
    payeeKey,
    serialNumber: counter.sequence,
    invoiceNumber: String(counter.sequence),
  };
};

module.exports = generateInvoiceNumber;
module.exports.getPayeeKey = getPayeeKey;
module.exports.getPayeeSerialNumber = getPayeeSerialNumber;
