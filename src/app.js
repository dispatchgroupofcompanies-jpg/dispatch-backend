const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const connectDB = require("./config/db");
const companyRoutes = require("./routes/companyRoutes");

// Admin Routes
const adminDashboardRoutes = require("./routes/admin/dashboard.routes");
const adminInvoiceRoutes = require("./routes/admin/invoice.routes");
const adminAppointmentRoutes = require("./routes/admin/appointment.routes");
const adminUserRoutes = require("./routes/admin/user.routes");
const adminRoutes = require("./routes/admin.routes");

// User Routes
const userInvoiceRoutes = require("./routes/user/invoice.routes");
const userAppointmentRoutes = require("./routes/user/appointment.routes");
const userDashboardRoutes = require("./routes/user/dashboard.routes");

// Legacy Routes (to be removed after migration)
const legacyInvoiceRoutes = require("./routes/invoice.routes");
const legacyAppointmentRoutes = require("./routes/appointment.routes");

const app = express();

// 1. DATABASE CONNECTION
connectDB();

// 2. 🔥 CORE CORS MIDDLEWARE (MUST BE ON TOP OF EVERYTHING)
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000", // Specify frontend origin for credentials support
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // ✅ FIXED: Added 'PATCH' because status change uses PATCH
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type", "Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    return res.sendStatus(200);
  }
  next();
});

// 4. PARSING MIDDLEWARES
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

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

// Legacy Routes (kept for backward compatibility during migration)
app.use("/api/invoices", legacyInvoiceRoutes);
app.use("/api/appointments", legacyAppointmentRoutes);

module.exports = app;