const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const helmet = require("helmet");
const { apiLimiter } = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/error.middleware");

const authRoutes = require("./routes/auth.routes");
const companyRoutes = require("./routes/companyRoutes");

// Admin Routes
const adminDashboardRoutes = require("./routes/admin/dashboard.routes");
const adminInvoiceRoutes = require("./routes/admin/invoice.routes");
const adminAppointmentRoutes = require("./routes/admin/appointment.routes");
const adminLoadboardRoutes = require("./routes/admin/loadboard.routes");
const adminUserRoutes = require("./routes/admin/user.routes");
const adminRoutes = require("./routes/admin.routes");

// Public Routes (no authentication required)
const publicRoutes = require("./routes/public.routes");

// User Routes
const userLoadBoardRoutes = require("./routes/user/loadboard.routes");


const app = express();

// 1. TRUST PROXY CONFIGURATION
// Changed 'true' to 1 (1 proxy hop = Nginx). Solves express-rate-limit trustProxy error.
app.set("trust proxy", 1);

// 2. CORE CORS MIDDLEWARE
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim()).filter(url => url)
  : ["http://localhost:3000"];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    
    const isAllowed = allowedOrigins.indexOf(origin) !== -1;
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

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
app.use(morgan("dev"));

// 3. ROOT / HEALTH CHECK ROUTE
app.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "Dispatch Backend API running successfully" });
});

// Apply general API rate limiting
app.use("/api", apiLimiter);

// 7. APPLICATION API ROUTES

// Shared Routes
app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);

// Admin Routes
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/invoices", adminInvoiceRoutes);
app.use("/api/admin/appointments", adminAppointmentRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/loadboard", adminLoadboardRoutes);
app.use("/api/admin", adminRoutes);

// User Routes
app.use("/api/user/loadboard", userLoadBoardRoutes);

// Invoices and appointments are intentionally admin-only.

// Public Routes
app.use("/api", publicRoutes);

app.use(errorHandler);

module.exports = app;
