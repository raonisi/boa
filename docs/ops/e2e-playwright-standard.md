# E2E and Playwright Standard

E2E tests must validate user-visible routing and smoke behavior without using production data or real customer information.

## Data Rules

- Do not use production DB data.
- Do not use real customer information.
- Use mocks, fixtures, or local test-safe data.
- Do not hide required smoke failures with `skip`.

## Smoke Focus

Playwright smoke should focus on:

- route availability
- app root render
- unexpected console errors
- mobile viewport behavior
- desktop/mobile coverage split
- current canonical routes and redirects

Use a dedicated dev-server port for e2e when possible. If a stale server already owns the port, fail clearly rather than silently reusing the wrong server.

Check that `/src/main.tsx` is served as JavaScript and not as SPA fallback HTML.

## Route Smoke Candidates

- `/`
- `/customers`
- `/calendar`
- `/notifications`
- `/performance` or canonical `/analytics`
- `/operation-risk`
- `/admin-audit` deprecated redirect

## Failure Reporting

- Report only the key failing command and core error lines.
- Separate current-task failures from pre-existing failures.
- If e2e fails, operational readiness may be withheld.
- Do not skip failing smoke tests to make the suite green.

## Verification Commands

Required when relevant:

- `pnpm.cmd check`
- `pnpm.cmd test`
- `pnpm.cmd build`
- `pnpm.cmd test:e2e`

Possible additional checks:

- `pnpm.cmd exec cap sync android`
- `cd android && gradlew.bat assembleDebug`
