const Invoice = require("../models/invoice.model");
const User = require("../models/user.model");
const { escapeRegex } = require("./invoiceVrid.service");

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const positiveInteger = (value, fallback, max) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw badRequest("Invalid pagination.");
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) throw badRequest("Invalid pagination.");
  return number;
};

const buildInvoiceSearch = (query) => {
  const page = positiveInteger(query.page, 1, 1000000);
  const limit = positiveInteger(query.limit, 20, 100);
  if (query.q !== undefined && (typeof query.q !== "string" || query.q.length > 200)) {
    throw badRequest("Search must be text of at most 200 characters.");
  }
  const q = (query.q || "").trim();
  let companies = [];
  if (query.companies !== undefined) {
    try { companies = JSON.parse(query.companies); } catch { throw badRequest("Invalid companies filter."); }
    if (!Array.isArray(companies) || companies.length > 200 || companies.some(name => typeof name !== "string" || name.length > 300)) {
      throw badRequest("Invalid companies filter.");
    }
  }
  const payment = query.paymentStatus || "all";
  if (!["all", "paid", "pending"].includes(payment)) throw badRequest("Invalid payment status.");
  const match = {};
  if (companies.length) match.searchCompany = { $in: companies };
  if (q) {
    const words = q.split(/\s+/).map(escapeRegex);
    const regex = new RegExp(words.join("\\s+"), "i");
    match.$or = ["payee.companyName", "customer.companyName", "invoiceNumber", "trips.vrid", "trips.loadId1", "trips.loadId2"]
      .map(field => ({ [field]: regex }));
    match.$or.push({ $expr: { $regexMatch: { input: { $toString: "$_id" }, regex } } });
    match.$or.push({ trips: { $elemMatch: { $and: words.map(word => ({ driverName: new RegExp(word, "i") })) } } });
  }
  const paymentMatch = payment === "all" ? {} : { searchPayment: payment };
  return { page, limit, match, paymentMatch };
};

const searchInvoices = async (query) => {
  const { page, limit, match, paymentMatch } = buildInvoiceSearch(query);
  const [result] = await Invoice.aggregate([
    { $set: {
      searchCompany: { $let: { vars: { name: { $trim: { input: { $ifNull: ["$payee.companyName", ""] } } } }, in: { $cond: [{ $eq: ["$$name", ""] }, "Unassigned company", "$$name"] } } },
      searchPayment: { $toLower: { $ifNull: ["$paymentStatus", "pending"] } },
    } },
    { $facet: {
      companies: [
        { $group: { _id: "$searchCompany", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
      paymentCounts: [
        { $match: match },
        { $group: { _id: "$searchPayment", count: { $sum: 1 } } },
      ],
      total: [{ $match: match }, { $match: paymentMatch }, { $count: "count" }],
      data: [
        { $match: match }, { $match: paymentMatch },
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: (page - 1) * limit }, { $limit: limit },
        { $lookup: { from: User.collection.name, localField: "createdBy", foreignField: "_id", pipeline: [{ $project: { name: 1, email: 1 } }], as: "creator" } },
        { $set: { createdByUser: { $ifNull: [{ $arrayElemAt: ["$creator", 0] }, null] } } },
        { $unset: ["creator", "searchCompany", "searchPayment"] },
      ],
    } },
  ]);
  const data = (result?.data || []).map(invoice => {
    let carrierNeedToPay = 0;
    let carrierNeedsToReceive = 0;
    for (const trip of invoice.trips || []) {
      const charges = Number(trip.totalCharges || 0);
      const dispatch = charges * Number(trip.dispatchPercentage || trip.dispatchPercent || 10) / 100;
      carrierNeedToPay += dispatch;
      carrierNeedsToReceive += charges - dispatch;
    }
    return { ...invoice, carrierNeedToPay, carrierNeedsToReceive };
  });
  const paymentCounts = { paid: 0, pending: 0 };
  for (const entry of result?.paymentCounts || []) {
    if (entry._id === "paid" || entry._id === "pending") paymentCounts[entry._id] = entry.count;
  }
  return {
    success: true, data, currentPage: page,
    totalInvoices: result?.total?.[0]?.count || 0,
    companies: (result?.companies || []).map(company => ({ value: company._id, label: `${company._id} (${company.count})` })),
    paymentCounts,
  };
};

module.exports = { buildInvoiceSearch, searchInvoices };
