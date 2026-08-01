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

const getHighestExistingSequence = async (query, field) => {
  try {
    const result = await Invoice.aggregate([
      { $match: query },
      { $project: { seq: { $toInt: `$${field}` } } },
      { $sort: { seq: -1 } },
      { $limit: 1 },
    ]);

    if (result.length && Number.isFinite(result[0]?.seq)) {
      return result[0].seq;
    }
  } catch (err) {
    console.warn(`Unable to determine highest existing ${field}:`, err.message);
  }

  return Invoice.countDocuments(query);
};

const getNextCounterSequence = async (counterName, seed = 0) => {
  const counter = await Counter.findOneAndUpdate(
    { name: counterName },
    {
      $setOnInsert: { sequence: seed },
      $max: { sequence: seed },
      $inc: { sequence: 1 },
    },
    {
      returnDocument: "after",
      upsert: true,
    }
  );

  return counter.sequence;
};

const generateInvoiceNumber = async (payee) => {
  const payeeKey = getPayeeKey(payee);
  const counterName = `invoice:${payeeKey}`;
  const globalCounterName = "invoice";
  const { payeeQueries } = getPayeeQuery({ payee });

  const highestGlobalInvoice = await getHighestExistingSequence({ invoiceNumber: { $exists: true } }, "invoiceNumber");
  const highestPayeeInvoice = await getHighestExistingSequence({ $or: payeeQueries }, "payeeSerialNumber");

  const [globalSequence, payeeSequence] = await Promise.all([
    getNextCounterSequence(globalCounterName, highestGlobalInvoice),
    getNextCounterSequence(counterName, highestPayeeInvoice),
  ]);

  return {
    payeeKey,
    serialNumber: payeeSequence,
    invoiceNumber: String(globalSequence),
  };
};

module.exports = generateInvoiceNumber;
module.exports.getPayeeKey = getPayeeKey;
module.exports.getPayeeSerialNumber = getPayeeSerialNumber;
