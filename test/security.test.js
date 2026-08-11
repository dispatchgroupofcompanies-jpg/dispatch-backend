const test = require("node:test");
const assert = require("node:assert/strict");
const { requireAdmin } = require("../src/middleware/authorize.middleware");

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("requireAdmin rejects ordinary users", () => {
  const response = createResponse();
  let called = false;

  requireAdmin(
    { accountType: "user", user: { role: "user" } },
    response,
    () => {
      called = true;
    },
  );

  assert.equal(called, false);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.success, false);
});

test("requireAdmin permits admin accounts", () => {
  const response = createResponse();
  let called = false;

  requireAdmin(
    { accountType: "admin", user: { role: "admin" } },
    response,
    () => {
      called = true;
    },
  );

  assert.equal(called, true);
  assert.equal(response.statusCode, null);
});
