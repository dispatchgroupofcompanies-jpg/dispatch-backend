const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const helmet = require("helmet");
const { apiLimiter } = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/error.middleware");
const { requireTrustedOrigin } = require("./middleware/csrf.middleware");

const { allowedOrigins, corsOptions } = require("./config/cors");
const registerRoutes = require("./routes");

const app = express();

// 1. TRUST PROXY CONFIGURATION
// Changed 'true' to 1 (1 proxy hop = Nginx). Solves express-rate-limit trustProxy error.
app.set("trust proxy", 1);

// 2. CORE CORS MIDDLEWARE
app.use(cors(corsOptions));

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "1mb" }));

// Catch bad JSON bodies without throwing server errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: "Invalid JSON format" });
  }
  next();
});

app.use(cookieParser());
app.use(requireTrustedOrigin(allowedOrigins));
app.use(morgan("dev"));

// 3. ROOT / HEALTH CHECK ROUTE
app.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "Dispatch Backend API running successfully" });
});

// Apply general API rate limiting
app.use("/api", apiLimiter);

registerRoutes(app);

app.use(errorHandler);

module.exports = app;
