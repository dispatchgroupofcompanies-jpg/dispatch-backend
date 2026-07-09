const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const path = require("path");
const { apiLimiter } = require("./middleware/rateLimiter");
const ipWhitelist = require("./middleware/ipWhitelist");

const authRoutes = require("./routes/auth.routes");
const connectDB = require("./config/db");
const companyRoutes = require("./routes/companyRoutes");

// Admin Routes
const adminDashboardRoutes = require("./routes/admin/dashboard.routes");
const adminInvoiceRoutes = require("./routes/admin/invoice.routes");
const adminAppointmentRoutes = require("./routes/admin/appointment.routes");
const adminUserRoutes = require("./routes/admin/user.routes");
const adminRoutes = require("./routes/admin.routes");

// Public Routes (no authentication required)
const publicRoutes = require("./routes/public.routes");

// User Routes
const userInvoiceRoutes = require("./routes/user/invoice.routes");
const userAppointmentRoutes = require("./routes/user/appointment.routes");
const userDashboardRoutes = require("./routes/user/dashboard.routes");
const userLoadBoardRoutes = require("./routes/user/loadboard.routes");

// Legacy Routes
const legacyInvoiceRoutes = require("./routes/invoice.routes");
const legacyAppointmentRoutes = require("./routes/appointment.routes");

const app = express();

// Configure trust proxy for Render (handles X-Forwarded-For header)
app.set("trust proxy", true);

// 1. DATABASE CONNECTION
connectDB();

// 2. 🔥 IP WHITELIST MIDDLEWARE (MUST BE BEFORE CORS)
// Enforce in production OR when ENABLE_IP_WHITELIST is explicitly set to "true"
if (process.env.NODE_ENV === "production" || process.env.ENABLE_IP_WHITELIST === "true") {
  console.log(`🔒 IP Whitelist middleware enabled (NODE_ENV=${process.env.NODE_ENV}, ENABLE_IP_WHITELIST=${process.env.ENABLE_IP_WHITELIST || "not set"})`);
  app.use(ipWhitelist);
} else {
  console.log("ℹ️  IP Whitelist middleware disabled (development mode without ENABLE_IP_WHITELIST)");
}

// 3. 🔥 CORE CORS MIDDLEWARE (MUST BE ON TOP OF EVERYTHING)
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim()).filter(url => url)
  : ["http://localhost:3000"];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
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

// 4. PARSING MIDDLEWARES
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// Apply general API rate limiting
// app.use("/api", apiLimiter);

// 4.5 STATIC FILE SERVING FOR UPLOADS
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 5. APPLICATION API ROUTES

// Shared Routes (accessible by both admin and user)
app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);

// Admin Routes
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/invoices", adminInvoiceRoutes);
app.use("/api/admin/appointments", adminAppointmentRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin", adminRoutes);

// User Routes
app.use("/api/user/invoices", userInvoiceRoutes);
app.use("/api/user/appointments", userAppointmentRoutes);
app.use("/api/user/dashboard", userDashboardRoutes);
app.use("/api/user/loadboard", userLoadBoardRoutes);

// Public Routes (accessible without authentication)
app.use("/api", publicRoutes);

// Legacy Routes (kept for backward compatibility during migration)
app.use("/api/invoices", legacyInvoiceRoutes);
app.use("/api/appointments", legacyAppointmentRoutes);

module.exports = app;