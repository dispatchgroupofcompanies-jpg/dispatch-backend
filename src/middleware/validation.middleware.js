const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(422).json({
    success: false,
    message: "Request validation failed.",
    errors: errors.array().map(({ path, msg }) => ({ field: path, message: msg })),
  });
};

const validateObjectId = (param = "id") => (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params[param])) {
    return res.status(400).json({ success: false, message: `Invalid ${param}.` });
  }
  next();
};

const getPagination = (query, { defaultLimit = 10, maxLimit = 100 } = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

module.exports = { validateRequest, validateObjectId, getPagination };
