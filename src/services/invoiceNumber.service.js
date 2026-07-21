const Counter = require("../models/Counter");

const generateInvoiceNumber = async () => {
  const counter = await Counter.findOneAndUpdate(
    {
      name: "invoice",
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

  return String(counter.sequence);
};

module.exports = generateInvoiceNumber;