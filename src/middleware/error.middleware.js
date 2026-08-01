const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (res.headersSent) return next(err);

  if (err.name === "ValidationError") {
    return res.status(422).json({ success: false, message: "Validation failed." });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid resource identifier." });
  }

  return res.status(err.status || 500).json({
    success: false,
    message: err.status ? err.message : "Internal server error.",
  });
};

module.exports = errorHandler;
