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

const getHighestNumericFieldValue = async (matchFilter, fieldName) => {
  const result = await Invoice.aggregate([
    { $match: matchFilter },
    {
      $project: {
        numericValue: {
          $cond: [
            {
              $in: [
                { $type: `$${fieldName}` },
                ["int", "long", "double"]
              ]
            },
            `$${fieldName}`,
            {
              $toLong: `$${fieldName}`
            }
          ]
        }
      }
    },
    { $sort: { numericValue: -1 } },
    { $limit: 1 }
  ]);

  return result?.[0]?.numericValue ?? 0;
};

const getHighestNumericInvoiceNumber = async () => {
  return getHighestNumericFieldValue(
    {
      $or: [
        { invoiceNumber: { $type: "int" } },
        { invoiceNumber: { $type: "long" } },
        { invoiceNumber: { $type: "double" } },
        {
          $and: [
            { invoiceNumber: { $type: "string" } },
            { invoiceNumber: { $regex: "^[0-9]+$" } }
          ]
        }
      ]
    },
    "invoiceNumber"
  );
};

const getHighestNumericPayeeSerialNumber = async (payeeKey) => {
  return getHighestNumericFieldValue(
    {
      payeeKey,
      $or: [
        { payeeSerialNumber: { $type: "int" } },
        { payeeSerialNumber: { $type: "long" } },
        { payeeSerialNumber: { $type: "double" } },
        {
          $and: [
            { payeeSerialNumber: { $type: "string" } },
            { payeeSerialNumber: { $regex: "^[0-9]+$" } }
          ]
        }
      ]
    },
    "payeeSerialNumber"
  );
};

const getNextCounterSequence = async (counterName, seed = 0) => {
  const pipeline = [
    {
      $set: {
        sequence: {
          $add: [
            {
              $max: [
                { $ifNull: ["$sequence", seed] },
                seed
              ]
            },
            1
          ]
        }
      }
    }
  ];

  const counter = await Counter.findOneAndUpdate(
    { name: counterName },
    pipeline,
    {
      upsert: true,
      returnDocument: "after",
      updatePipeline: true
    }
  );

  return counter.sequence;
};

const generateInvoiceNumber = async (payee) => {
  const payeeKey = getPayeeKey(payee);
  const counterName = `invoice:${payeeKey}`;

  const [highestGlobalInvoice, highestPayeeInvoice] = await Promise.all([
    getHighestNumericInvoiceNumber(),
    getHighestNumericPayeeSerialNumber(payeeKey)
  ]);

  const payeeInvoiceCount = await Invoice.countDocuments({ payeeKey });
  const payeeSeed = Math.max(highestPayeeInvoice, payeeInvoiceCount);

  const [globalSequence, payeeSequence] = await Promise.all([
    getNextCounterSequence("invoice", highestGlobalInvoice),
    getNextCounterSequence(counterName, payeeSeed)
  ]);

  return {
    payeeKey,
    serialNumber: payeeSequence,
    invoiceNumber: String(globalSequence)
  };
};

const getPayeeSerialNumber = async (invoice) => {
  if (!invoice?.createdAt) return invoice?.payeeSerialNumber || 1;

  const { payeeQueries } = getPayeeQuery(invoice);
  return Invoice.countDocuments({
    $and: [
      { $or: payeeQueries },
      {
        $or: [
          { createdAt: { $lt: new Date(invoice.createdAt) } },
          { createdAt: new Date(invoice.createdAt), _id: { $lte: invoice._id } }
        ]
      }
    ]
  });
};

module.exports = generateInvoiceNumber;
module.exports.getPayeeKey = getPayeeKey;
module.exports.getPayeeSerialNumber = getPayeeSerialNumber;
