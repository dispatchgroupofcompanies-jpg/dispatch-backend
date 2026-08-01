const requireAdmin = (req, res, next) => {
  if (req.accountType !== "admin" && req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access is required." });
  }
  next();
};

module.exports = { requireAdmin };
