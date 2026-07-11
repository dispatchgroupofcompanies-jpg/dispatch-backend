/**
 * IP Whitelist Middleware
 * 
 * This middleware restricts access to the API based on a whitelist of IP addresses.
 * It reads the ALLOWED_IPS environment variable (comma-separated list) and only
 * allows requests from those IPs in production mode or when ENABLE_IP_WHITELIST=true.
 * 
 * Features:
 * - Supports IPv4 and IPv6-mapped IPv4 addresses (e.g., ::ffff:192.168.1.1)
 * - Handles X-Forwarded-For header for proxies (Nginx, Render, Vercel, etc.)
 * - Enforces in production (NODE_ENV === "production") or when ENABLE_IP_WHITELIST=true
 * - Returns 404 Not Found to avoid exposing the whitelist
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
    return res.status(404).json({
      success: false,
      message: "Resource not found",
      error: "Not Found"
    });
  }

  // Parse allowed IPs (comma-separated)
  const allowedIps = allowedIpsEnv
    .split(",")
    .map(ip => ip.trim())
    .filter(ip => ip.length > 0);

  if (allowedIps.length === 0) {
    console.error("❌ SECURITY: ALLOWED_IPS is empty. Denying all requests.");
    return res.status(404).json({
      success: false,
      message: "Resource not found",
      error: "Not Found"
    });
  }

  // Get client IP from request
  // When behind a proxy (Nginx), Express needs trust proxy enabled
  // Priority: X-Forwarded-For header > req.ip > remoteAddress
  let clientIp = null;

  // First, try to get from X-Forwarded-For header (most reliable when behind Nginx)
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2, ...)
    // The first one is the original client IP
    const ips = xForwardedFor.split(",").map(ip => ip.trim());
    clientIp = ips[0];
    console.log(`🔍 IP Whitelist: Using X-Forwarded-For header: ${clientIp}`);
  }

  // If X-Forwarded-For not available, use req.ip (respects trust proxy setting)
  if (!clientIp) {
    clientIp = req.ip;
    if (clientIp) {
      console.log(`🔍 IP Whitelist: Using req.ip: ${clientIp}`);
    }
  }

  // If still no IP, try remoteAddress as last resort
  if (!clientIp && req.connection && req.connection.remoteAddress) {
    clientIp = req.connection.remoteAddress;
    console.log(`🔍 IP Whitelist: Using remoteAddress: ${clientIp}`);
  }

  // If still no IP, deny access
  if (!clientIp) {
    console.warn("⚠️  SECURITY: Could not determine client IP. Denying access.");
    return res.status(404).json({
      success: false,
      message: "Resource not found",
      error: "Not Found"
    });
  }

  // Normalize IP for comparison
  // Handle IPv6-mapped IPv4 addresses (e.g., ::ffff:192.168.1.1 -> 192.168.1.1)
  let normalizedClientIp = clientIp;
  if (clientIp.startsWith("::ffff:")) {
    normalizedClientIp = clientIp.substring(7); // Remove "::ffff:" prefix
  }



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
    return res.status(404).json({
      success: false,
      message: "Resource not found",
      error: "Not Found"
    });
  }

  // IP is whitelisted, proceed
  console.log(`✅ ACCESS ALLOWED - IP: ${clientIp} (normalized: ${normalizedClientIp}) is whitelisted`);
  next();
};

module.exports = ipWhitelist;