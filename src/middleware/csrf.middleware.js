const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Cookie-authenticated writes must originate from the configured frontend.
// Browsers send Origin on fetch and form POSTs; rejecting an absent Origin also
// prevents a cross-site form from bypassing this check.
const requireTrustedOrigin = (allowedOrigins) => (req, res, next) => {
  if (!unsafeMethods.has(req.method) || !req.cookies?.token) return next();

  const origin = req.get("Origin");
  if (origin && allowedOrigins.includes(origin)) return next();

  return res.status(403).json({ success: false, message: "Untrusted request origin." });
};

module.exports = { requireTrustedOrigin };
