const test = require("node:test");
const assert = require("node:assert/strict");

test("route registration preserves existing paths and order", () => {
  const paths = [];
  require("../src/routes")({ use: (path, router) => {
    assert.equal(typeof router, "function");
    paths.push(path);
  } });
  assert.deepEqual(paths, [
    "/api/auth", "/api/company", "/api/admin/dashboard", "/api/admin/invoices",
    "/api/admin/appointments", "/api/admin/loadboard", "/api/admin/users",
    "/api/admin", "/api/user/loadboard", "/api",
  ]);
});

test("admin profile uses the authenticated account and preserves response fields", async () => {
  const account = { _id: "123", name: "Admin", email: "admin@example.com", role: "admin", address: "Office", isActive: true };
  let response;
  await require("../src/controllers/admin/account.controller").getAdminProfile(
    { user: account },
    { json: (body) => { response = body; } },
  );
  assert.deepEqual(response, { success: true, admin: {
    id: "123", name: "Admin", email: "admin@example.com", role: "admin", address: "Office", isActive: true,
  } });
  assert.equal(require("../src/controllers/admin.controller"), require("../src/controllers/admin/account.controller"));
});

test("stopping backup scheduling cancels the startup timeout and interval", (t) => {
  const cleared = [];
  t.mock.method(global, "setTimeout", () => "startup");
  t.mock.method(global, "setInterval", () => "interval");
  t.mock.method(global, "clearTimeout", (id) => cleared.push(id));
  t.mock.method(global, "clearInterval", (id) => cleared.push(id));
  const { startScheduler, stopScheduler } = require("../src/backup/scheduler");
  startScheduler();
  stopScheduler();
  stopScheduler();
  assert.deepEqual(cleared, ["startup", "interval"]);
  assert.equal(typeof require("../src/backup").stopScheduler, "function");
});


test("dashboard preserves scoped statistics and empty-result defaults", async (t) => {
  const Invoice = require("../src/models/invoice.model");
  const owner = new (require("mongoose").Types.ObjectId)();
  let pipeline;
  let rows = [{ totalInvoices: 3, pendingInvoices: 1, approvedInvoices: 2, totalRevenue: 750 }];
  t.mock.method(Invoice, "aggregate", async (value) => { pipeline = value; return rows; });
  t.mock.method(Invoice, "find", (filter) => {
    assert.equal(filter.createdBy, owner);
    return { sort: () => ({ limit: async () => [] }) };
  });
  let response;
  const res = { status(code) { assert.equal(code, 200); return this; }, json(body) { response = body; } };
  const controller = require("../src/controllers/admin/dashboard.controller");
  await controller.getDashboardStats({ accountType: "user", user: { _id: owner } }, res);
  assert.equal(pipeline[0].$match.createdBy, owner);
  assert.deepEqual(response.data.stats, rows[0]);
  rows = [];
  await controller.getDashboardStats({ accountType: "user", user: { _id: owner } }, res);
  assert.deepEqual(response.data.stats, { totalInvoices: 0, pendingInvoices: 0, approvedInvoices: 0, totalRevenue: 0 });
});

test("appointments batch creator lookup and retain userId and missing-user responses", async (t) => {
  const Appointment = require("../src/models/appointment.model");
  const User = require("../src/models/user.model");
  const docs = [{ _id: "a", userId: "owner" }, { _id: "b", userId: "owner" }, { _id: "c", userId: "missing" }, { _id: "d" }];
  const appointments = docs.map((doc) => ({ ...doc, toObject: () => doc }));
  t.mock.method(Appointment, "countDocuments", async () => 4);
  t.mock.method(Appointment, "find", () => ({ sort: () => ({ skip: () => ({ limit: async () => appointments }) }) }));
  let lookups = 0;
  t.mock.method(User, "find", (filter) => {
    lookups++;
    assert.deepEqual(filter._id.$in, ["owner", "missing"]);
    return { select: () => ({ lean: async () => [{ _id: "owner", name: "Creator", email: "creator@example.com" }] }) };
  });
  let response;
  await require("../src/controllers/admin/appointment.controller").getAppointments(
    { accountType: "admin", query: {} },
    { json(body) { response = body; }, status() { throw new Error("Unexpected failure"); } },
  );
  assert.equal(lookups, 1);
  assert.equal(response.total, 4);
  assert.equal(response.data[0].userId, "owner");
  assert.deepEqual(response.data[0].createdByUser, { name: "Creator", email: "creator@example.com" });
  assert.equal(response.data[2].createdByUser, null);
  assert.equal(response.data[3].createdByUser, null);
});
