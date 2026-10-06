const mongoose = require("mongoose");
const Invoice = require("../models/invoice.model");
const WriteGuard = require("../models/invoiceWriteGuard.model");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactVrid = (value) => new RegExp(`^\\s*${escapeRegex(value.trim())}\\s*$`, "i");
const invoiceError = (message, status = 409) => Object.assign(new Error(message), { status });

const validateVrids = (trips) => {
  if (!Array.isArray(trips) || trips.length === 0) {
    throw invoiceError("At least one trip is required.", 400);
  }
  const seen = new Set();
  return trips.map((trip) => {
    if (typeof trip?.vrid !== "string" || !trip.vrid.trim()) {
      throw invoiceError("Every trip must have a VRID.", 400);
    }
    const vrid = trip.vrid.trim();
    const key = vrid.toLowerCase();
    if (seen.has(key)) throw invoiceError(`VRID ${vrid} is duplicated in this invoice.`);
    seen.add(key);
    return vrid;
  });
};

const assertVridsAvailable = async (trips, excludeInvoiceId, session) => {
  const vrids = validateVrids(trips);
  const duplicate = await Invoice.findOne({
    "trips.vrid": { $in: vrids.map(exactVrid) },
    ...(excludeInvoiceId ? { _id: { $ne: excludeInvoiceId } } : {}),
  }).select("_id").session(session);
  if (duplicate) throw invoiceError("A VRID already exists in another invoice. Please check the trip VRIDs.");
};

// All create/edit invoice writes acquire the same database lock BEFORE reading.
// A transaction alone would allow two reads of 'available' followed by two inserts.
// The driver retries write conflicts with a fresh snapshot, across server instances.
const withInvoiceWrite = async (write) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await mongoose.connection.transaction(async (session) => {
        await WriteGuard.updateOne(
          { _id: "invoice-writes" },
          { $inc: { revision: 1 } },
          { upsert: true, session },
        );
        return write(session);
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
    } catch (error) {
      // Concurrent first-use upserts or a legacy writer's invoice-number collision.
      if (error.code === 11000 && attempt < 2) continue;
      if (error.code === 20 || error.codeName === "IllegalOperation") {
        throw invoiceError("Invoice saving requires MongoDB transaction support. Please contact the administrator.", 503);
      }
      throw error;
    }
  }
};

module.exports = { escapeRegex, exactVrid, validateVrids, assertVridsAvailable, withInvoiceWrite };
