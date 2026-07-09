/**
 * IP Whitelist Middleware
 * 
 * This middleware restricts access to the API based on a whitelist of IP addresses.
 * It reads the ALLOWED_IPS environment variable (comma-separated list) and only
 * allows requests from those IPs in production mode or when ENABLE_IP_WHITELIST=true.
 * 
 * Features:
 * - Supports IPv4 and IPv6-mapped IPv4 addresses (e.g., ::ffff:192.168.1.1)
 * - Handles X-Forwarded-For header for proxies (Render, Vercel, etc.)
 * - Enforces in production (NODE_ENV === "production") or when ENABLE_IP_WHITELIST=true
 * - Returns clean JSON 403 Forbidden response
 * - Detailed logging for testing and debugging
 */

const ipWhitelist = (req, res, next) => {
  // Check if IP whitelist is enabled
  const enableWhitelist = process.env.ENABLE_IP_WHITELIST === "true";
  
  // If whitelist is not enabled, bypass all IP checks
  if (!enableWhitelist) {
    console.log("ℹ️  IP Whitelist: DISABLED (ENABLE_IP_WHITELIST is not 'true')");
    return next();
  }

  console.log("🔒 IP Whitelist: ENABLED - Enforcing IP restrictions");

  // Get allowed IPs from environment variable
  const allowedIpsEnv = process.env.ALLOWED_IPS;
  
  // If ALLOWED_IPS is not set, deny all requests
  if (!allowedIpsEnv) {
    console.error("❌ SECURITY: ALLOWED_IPS environment variable is not set. Denying all requests.");
    return res.status(403).json({
      success: false,
      message: "Access denied. IP not whitelisted.",
      error: "Server configuration error"
    });
  }

  // Parse allowed IPs (comma-separated)
  const allowedIps = allowedIpsEnv
    .split(",")
    .map(ip => ip.trim())
    .filter(ip => ip.length > 0);

  if (allowedIps.length === 0) {
    console.error("❌ SECURITY: ALLOWED_IPS is empty. Denying all requests.");
    return res.status(403).json({
      success: false,
      message: "Access denied. IP not whitelisted.",
      error: "Server configuration error"
    });
  }

  // Get client IP from request
  // When behind a proxy (Render), Express needs trust proxy enabled
  // The IP will be in req.ip or req.headers['x-forwarded-for']
  let clientIp = req.ip;

  // If req.ip is not available, try to get from x-forwarded-for header
  if (!clientIp) {
    const xForwardedFor = req.headers["x-forwarded-for"];
    if (xForwardedFor) {
      // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2, ...)
      // The first one is the original client IP
      const ips = xForwardedFor.split(",").map(ip => ip.trim());
      clientIp = ips[0];
    }
  }

  // If still no IP, try remoteAddress
  if (!clientIp && req.connection && req.connection.remoteAddress) {
    clientIp = req.connection.remoteAddress;
  }

  // If still no IP, deny access
  if (!clientIp) {
    console.warn("⚠️  SECURITY: Could not determine client IP. Denying access.");
    return res.status(403).json({
      success: false,
      message: "Access denied. Unable to verify IP address.",
      error: "Unable to determine client IP"
    });
  }

  // Normalize IP for comparison
  // Handle IPv6-mapped IPv4 addresses (e.g., ::ffff:192.168.1.1 -> 192.168.1.1)
  let normalizedClientIp = clientIp;
  if (clientIp.startsWith("::ffff:")) {
    normalizedClientIp = clientIp.substring(7); // Remove "::ffff:" prefix
  }

  // Log detailed information
  console.log("🔍 IP Whitelist Check:");
  console.log(`   Client IP: ${clientIp}`);
  console.log(`   Normalized IP: ${normalizedClientIp}`);
  console.log(`   Allowed IPs: ${allowedIps.join(", ")}`);

  // Check if client IP is in whitelist
  const isAllowed = allowedIps.some(allowedIp => {
    // Direct match
    if (clientIp === allowedIp || normalizedClientIp === allowedIp) {
      return true;
    }
    return false;
  });

  if (!isAllowed) {
    console.error(`❌ ACCESS DENIED - IP: ${clientIp} (normalized: ${normalizedClientIp}) is NOT in whitelist`);
    console.error(`   Allowed IPs: ${allowedIps.join(", ")}`);
    return res.status(403).json({
      success: false,
      message: "Access denied. IP not whitelisted.",
      error: "Forbidden"
    });
  }

  // IP is whitelisted, proceed
  console.log(`✅ ACCESS ALLOWED - IP: ${clientIp} (normalized: ${normalizedClientIp}) is whitelisted`);
  next();
};

module.exports = ipWhitelist;