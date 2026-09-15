const test = require("node:test");
const assert = require("node:assert/strict");
const { requireAdmin } = require("../src/middleware/authorize.middleware");
const { requireTrustedOrigin } = require("../src/middleware/csrf.middleware");

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

test("cookie-authenticated writes reject a missing or foreign Origin", () => {
  const middleware = requireTrustedOrigin(["https://www.xcdgocpvtltd.org"]);
  for (const origin of [undefined, "https://attacker.example"]) {
    const response = createResponse();
    let called = false;
    middleware(
      { method: "POST", cookies: { token: "session" }, get: () => origin },
      response,
      () => { called = true; },
    );
    assert.equal(called, false);
    assert.equal(response.statusCode, 403);
  }
});

test("cookie-authenticated writes from the frontend are allowed", () => {
  const middleware = requireTrustedOrigin(["https://www.xcdgocpvtltd.org"]);
  const response = createResponse();
  let called = false;
  middleware(
    { method: "POST", cookies: { token: "session" }, get: () => "https://www.xcdgocpvtltd.org" },
    response,
    () => { called = true; },
  );
  assert.equal(called, true);
  assert.equal(response.statusCode, null);
});
