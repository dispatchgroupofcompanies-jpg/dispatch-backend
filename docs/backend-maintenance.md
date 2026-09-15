# Backend structure and deployment

## Responsibilities

- `server.js`: database connection, worker startup, HTTP listening and shutdown.
- `src/app.js`: Express middleware and application assembly.
- `src/config`: environment checks, auth cookie configuration and allowed origins.
- `src/routes/index.js`: stable API mount paths and registration order.
- `src/routes/admin`: admin authorization and routing; loadboard logic lives in its controller.
- `src/controllers/admin`: admin account, invoice, appointment, loadboard and device handlers.
- `src/services/pdf/render.service.js`: shared Chrome launch, A4 print options and guaranteed browser cleanup.
- `src/services/pdf.service.js`: invoice template/serial preparation and PDF upload.
- `src/backup`: existing backup synchronization, connections and scheduler.
- `test`: authorization, CSRF, route compatibility, profile and scheduler regression tests.
- `scripts/check-syntax.js`: recursively syntax-checks source/test code without running it.

Existing model names and MongoDB collection bindings are unchanged. Legacy controller entry points remain available. Original root admin/migration utilities and their imports are restored. They are never executed by startup, tests or syntax validation. The migration command again points to `migrate-payee-invoice-serials.js` in the backend root; it was not run.

## Render

Use Node 22.12 or newer within the Node 22 release line (the Puppeteer dependency requires this). The local review environment uses Node 20, so test results there do not replace verification on Node 22.

Build command: `npm ci && npx puppeteer browsers install chrome`.

Start command: `npm start`.

Remove an invalid `PUPPETEER_EXECUTABLE_PATH` override. Keep the existing project-local Puppeteer cache configuration. Both invoice and appointment PDFs use the same renderer; their HTML generators and upload naming remain unchanged. Check a standard invoice, a paid invoice and an appointment visually after deployment, because removing the legacy PDF wrapper also removes its CSS-inlining/Handlebars preprocessing. Their generated HTML is rendered directly by Chrome.

Frontend requests use its same-origin `/backend/api` rewrite. Set `FRONTEND_URL=https://www.xcdgocpvtltd.org` on Render and `BACKEND_API_URL=https://dispatch-backend-1-ukyv.onrender.com` in the frontend deployment. Keep `NODE_ENV=production` so the auth cookie is Secure.

## Validation

Run `npm run check`, `npm test`, and `npm audit --omit=dev` with registry access. An audit result is only a point-in-time check of known advisories.

After deployment check login, reload/session restoration, admin profile, invoice download, appointment download, and logout. Compare status codes, response fields and PDFs to the existing behavior. Password reset should be tested using a designated test account, not a live production account.

No migration, primary/backup database write, record deletion, Cloudinary upload/deletion, or existing admin utility was executed as part of this maintenance pass.

## Query optimization and cleanup

- Dashboard totals use one aggregation plus the recent-invoice query (previously five queries).
- Device statistics use one aggregation (previously five queries).
- Appointment lists resolve all creators in one projected, lean query instead of one query per appointment. The existing `userId` and `createdByUser` response fields are preserved, including missing-user handling. Appointment documents remain hydrated so legacy schema defaults remain in responses.
- Invoice and device lists fetch their count and page concurrently. Existing selected-field `populate` calls remain where the response requires populated users. Writes that use `save()` stay hydrated.
- Non-unique indexes cover global date sorts, invoice status/date, owner/status/date, appointment owner/date and device owner/date. Existing unique indexes and collection names are unchanged. Indexes have only been declared in schemas; no database connection, `syncIndexes()` or index deletion was run. Mongoose normally creates declared indexes at startup when autoIndex is enabled. Verify deployed indexes and query plans before claiming a measured production speedup.
- Original `src/utils/logger.js` and `test-api.js` are restored at the user's request. Admin and migration scripts are also restored to the backend root. No files from that cleanup remain deleted or relocated.

Validate dashboard statistics (including an empty database and a restricted user), appointment creators including deleted users, invoice status filters/pagination and device requests/statistics after deployment. No live database performance benchmark was performed.
