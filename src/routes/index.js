// Keep registration order stable: the broad admin router follows specific ones.
const registerRoutes = (app) => {
  app.use("/api/auth", require("./auth.routes"));
  app.use("/api/company", require("./companyRoutes"));
  app.use("/api/admin/dashboard", require("./admin/dashboard.routes"));
  app.use("/api/admin/invoices", require("./admin/invoice.routes"));
  app.use("/api/admin/appointments", require("./admin/appointment.routes"));
  app.use("/api/admin/loadboard", require("./admin/loadboard.routes"));
  app.use("/api/admin/users", require("./admin/user.routes"));
  app.use("/api/admin", require("./admin.routes"));
  app.use("/api/user/loadboard", require("./user/loadboard.routes"));
  app.use("/api", require("./public.routes"));
};

module.exports = registerRoutes;
