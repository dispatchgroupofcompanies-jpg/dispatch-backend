const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Invoice = require('../src/models/invoice.model');
const Guard = require('../src/models/invoiceWriteGuard.model');
const { validateVrids, exactVrid, assertVridsAvailable, withInvoiceWrite } = require('../src/services/invoiceVrid.service');
const { buildInvoiceSearch, searchInvoices } = require('../src/services/invoiceSearch.service');

test('VRIDs reject empty and duplicate trips, ignoring case and outer whitespace', () => {
  for (const trips of [[], [{ vrid: '' }], [{ vrid: ' ' }], [{ vrid: 332 }]]) {
    assert.throws(() => validateVrids(trips), error => error.status === 400);
  }
  assert.throws(() => validateVrids([{ vrid: ' AbC ' }, { vrid: 'abc' }]), error => error.status === 409);
  assert.deepEqual(validateVrids([{ vrid: '332' }, { vrid: '333' }]), ['332', '333']);
});

test('VRID lookup is literal, exact, case insensitive and tolerates legacy outer spaces', () => {
  const regex = exactVrid(' a.b+[3](x) ');
  assert.equal(regex.test(' A.B+[3](X) '), true);
  assert.equal(regex.test('aXb+[3](x)'), false);
  assert.equal(exactVrid('332').test('1332'), false);
});

test('duplicate checks use database without pagination and exclude only edited invoice', async t => {
  const session = {};
  let query;
  let found = null;
  t.mock.method(Invoice, 'findOne', filter => {
    query = filter;
    return { select: () => ({ session: async value => { assert.equal(value, session); return found; } }) };
  });
  await assertVridsAvailable([{ vrid: '332' }], 'self', session);
  assert.deepEqual(query._id, { $ne: 'self' });
  assert.equal(query['trips.vrid'].$in[0].test(' 332 '), true);
  found = { _id: 'other' };
  await assert.rejects(assertVridsAvailable([{ vrid: '332' }], null, session), error => error.status === 409);
  assert.equal(query._id, undefined);
});

test('invoice write acquires database guard before callback in the same transaction', async t => {
  const events = [];
  const session = {};
  t.mock.method(mongoose.connection, 'transaction', async (callback, options) => {
    assert.equal(options.writeConcern.w, 'majority');
    return callback(session);
  });
  t.mock.method(Guard, 'updateOne', async (filter, update, options) => {
    assert.equal(filter._id, 'invoice-writes');
    assert.equal(options.session, session);
    assert.equal(update.$inc.revision, 1);
    events.push('lock');
  });
  const result = await withInvoiceWrite(async value => {
    assert.equal(value, session);
    events.push('check-and-save');
    return 'saved';
  });
  assert.equal(result, 'saved');
  assert.deepEqual(events, ['lock', 'check-and-save']);
});

test('guard initialization collision retries; unavailable transactions never fall back to unsafe writes', async t => {
  let attempts = 0;
  let writes = 0;
  t.mock.method(mongoose.connection, 'transaction', async callback => {
    if (++attempts === 1) throw Object.assign(new Error('collision'), { code: 11000 });
    return callback({});
  });
  t.mock.method(Guard, 'updateOne', async () => {});
  await withInvoiceWrite(async () => { writes++; });
  assert.equal(attempts, 2);
  assert.equal(writes, 1);
  t.mock.method(mongoose.connection, 'transaction', async () => { throw Object.assign(new Error('standalone'), { code: 20 }); });
  await assert.rejects(withInvoiceWrite(async () => { writes++; }), error => error.status === 503);
  assert.equal(writes, 1);
});

test('two competing submissions are rechecked after acquiring the write guard', async t => {
  // Simulate the database transaction's serialization; no real database is used.
  let tail = Promise.resolve();
  const saved = [];
  t.mock.method(mongoose.connection, 'transaction', callback => {
    const result = tail.then(() => callback({}));
    tail = result.catch(() => {});
    return result;
  });
  t.mock.method(Guard, 'updateOne', async () => {});
  t.mock.method(Invoice, 'findOne', query => ({ select: () => ({ session: async () =>
    saved.some(vrid => query['trips.vrid'].$in.some(regex => regex.test(vrid))) ? { _id: 'first' } : null,
  }) }));
  const submit = vrid => withInvoiceWrite(async session => {
    await assertVridsAvailable([{ vrid }], null, session);
    saved.push(vrid);
  });
  const results = await Promise.allSettled([submit('332'), submit(' 332 ')]);
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected']);
  assert.equal(results[1].reason.status, 409);
  assert.equal(saved.length, 1);
});

test('search validates inputs and combines companies, status and driver words', () => {
  const { match, paymentMatch, page, limit } = buildInvoiceSearch({ q: ' Kumar   Raj ', companies: '["Alpha","Beta"]', paymentStatus: 'paid', page: '2', limit: '10' });
  assert.deepEqual(match.searchCompany.$in, ['Alpha', 'Beta']);
  assert.deepEqual(paymentMatch, { searchPayment: 'paid' });
  assert.equal(page, 2);
  assert.equal(limit, 10);
  const drivers = match.$or.at(-1).trips.$elemMatch.$and;
  assert.equal(drivers.every(rule => rule.driverName.test('Raj Kumar')), true);
  for (const query of [{ page: '-1' }, { limit: '1000' }, { companies: '{}' }, { companies: '[1]' }, { q: {} }, { paymentStatus: 'invalid' }]) {
    assert.throws(() => buildInvoiceSearch(query), error => error.status === 400);
  }
  const literal = buildInvoiceSearch({ q: '.*' }).match.$or[0]['payee.companyName'];
  assert.equal(literal.test('anything'), false);
  assert.equal(literal.test('literal .*'), true);
});

test('search applies filters before pagination, and counts the whole matching set', async t => {
  let pipeline;
  t.mock.method(Invoice, 'aggregate', async value => {
    pipeline = value;
    return [{ data: [{ _id: 'old-invoice', trips: [] }], total: [{ count: 1201 }], companies: [{ _id: 'Alpha', count: 1201 }], paymentCounts: [{ _id: 'paid', count: 1201 }] }];
  });
  const result = await searchInvoices({ q: '332', page: '101', limit: '10', paymentStatus: 'paid' });
  const facet = pipeline[1].$facet;
  assert.ok(facet.data[0].$match.$or);
  assert.deepEqual(facet.data[1], { $match: { searchPayment: 'paid' } });
  assert.deepEqual(facet.data[3], { $skip: 1000 });
  assert.deepEqual(facet.data[4], { $limit: 10 });
  assert.equal(facet.total.some(stage => stage.$limit || stage.$skip), false);
  assert.equal(result.totalInvoices, 1201);
  assert.equal(result.data[0]._id, 'old-invoice');
  assert.equal(result.paymentCounts.paid, 1201);
});

test('create and edit controllers enforce VRIDs before saving and allow unchanged own VRID', async t => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { createRequire } = require('node:module');
  const filename = path.resolve(__dirname, '../src/controllers/admin/invoice.controller.js');
  const localRequire = createRequire(filename);
  const moduleStub = { exports: {} };
  const pdf = async () => 'test-pdf';
  pdf.generateInvoicePdfBuffer = async () => Buffer.from('test');
  const injectedRequire = name => {
    if (name.endsWith('/pdf.service')) return pdf;
    if (name.endsWith('/invoiceNumber.service')) return async () => ({ invoiceNumber: '42', payeeKey: 'alpha', serialNumber: 1 });
    if (name.endsWith('/email.service')) return async () => {};
    if (name.endsWith('/cloudinary.service')) return {};
    return localRequire(name);
  };
  new Function('require', 'module', 'exports', fs.readFileSync(filename, 'utf8'))(injectedRequire, moduleStub, moduleStub.exports);
  const controller = moduleStub.exports;
  const session = {};
  t.mock.method(mongoose.connection, 'transaction', callback => callback(session));
  t.mock.method(Guard, 'updateOne', async () => {});
  t.mock.method(console, 'error', () => {});
  let duplicate = true;
  let exclusion;
  t.mock.method(Invoice, 'findOne', query => {
    exclusion = query._id;
    return { select: () => ({ session: async () => duplicate ? { _id: 'other' } : null }) };
  });
  let saves = 0;
  const own = { _id: 'own', trips: [{ vrid: '332', totalCharges: 100 }],
    $session: () => {}, save: async () => { saves++; },
  };
  t.mock.method(Invoice, 'findById', () => ({ session: async () => own }));
  let creates = 0;
  t.mock.method(Invoice, 'create', async (docs, options) => {
    creates++;
    assert.equal(options.session, session);
    assert.equal(docs[0].trips[0].vrid, '332');
    return [own];
  });
  const res = () => ({ code: 200, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } });
  const request = { body: { payee: { companyName: 'Alpha' }, trips: [{ vrid: '332', totalCharges: 100 }] }, params: { id: 'own' } };
  let response = res();
  await controller.createInvoice(request, response);
  assert.equal(response.code, 409);
  assert.equal(creates, 0);
  response = res();
  await controller.updateInvoice(request, response);
  assert.equal(response.code, 409);
  assert.equal(saves, 0);
  assert.deepEqual(exclusion, { $ne: 'own' });
  duplicate = false;
  response = res();
  await controller.updateInvoice(request, response);
  assert.equal(response.code, 200);
  assert.equal(response.body.success, true);
  assert.equal(own.trips[0].vrid, '332');
  response = res();
  await controller.createInvoice(request, response);
  assert.equal(response.code, 201);
  assert.equal(creates, 1);
});
