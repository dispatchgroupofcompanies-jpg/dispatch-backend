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

const getSortedNumericFieldValues = async (matchFilter, fieldName) => {
  const results = await Invoice.aggregate([
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
    { $match: { numericValue: { $gt: 0 } } },
    { $sort: { numericValue: 1 } }
  ]);

  return results.map((item) => item.numericValue);
};

const getNextSequentialNumber = (values) => {
  let next = 1;
  for (const value of values) {
    const current = Number(value);
    if (current < next) continue;
    if (current === next) {
      next += 1;
      continue;
    }
    if (current > next) break;
  }
  return next;
};

const getNextInvoiceNumber = async () => {
  const values = await getSortedNumericFieldValues(
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

  return getNextSequentialNumber(values);
};

const getNextPayeeSerialNumber = async (payeeKey) => {
  const values = await getSortedNumericFieldValues(
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

  return getNextSequentialNumber(values);
};

const generateInvoiceNumber = async (payee) => {
  const payeeKey = getPayeeKey(payee);
  const [invoiceNumber, serialNumber] = await Promise.all([
    getNextInvoiceNumber(),
    getNextPayeeSerialNumber(payeeKey),
  ]);

  return {
    payeeKey,
    serialNumber,
    invoiceNumber: String(invoiceNumber),
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
