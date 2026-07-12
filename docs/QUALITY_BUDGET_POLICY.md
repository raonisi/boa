# Quality Budget Policy

PR-QA-GATE-02 adds progressive accessibility, coverage, and production bundle
budgets. These checks measure the current product honestly and block new
regressions without pretending that accumulated debt is already resolved.

## Local commands

Run these commands from the repository root:

```text
pnpm.cmd test:coverage
pnpm.cmd build
pnpm.cmd bundle:check
pnpm.cmd test:e2e:accessibility
```

The accessibility command requires the same disposable local `boa_e2e` MySQL,
synthetic seed, and E2E environment variables as `test:e2e:critical`. It never
connects to the production database or uses a real OAuth account.

## Coverage ratchet

Vitest uses `@vitest/coverage-v8@2.1.9`. The baseline at main SHA `04be567` is:

| Metric | Measured | Blocking threshold |
| --- | ---: | ---: |
| Statements | 33.79% | 33.7% |
| Branches | 70.07% | 70.0% |
| Functions | 47.52% | 47.5% |
| Lines | 33.79% | 33.7% |

Coverage includes `server/**/*.ts`, `client/src/**/*.{ts,tsx}`, and
`shared/**/*.ts`, including server routers, customer access logic, schedule
visibility, and schedule-request approval logic. Tests, declarations, and the
two bootstrap entry files are excluded. Generated output, migrations, E2E
fixtures, and platform wrappers are outside the include scope.

Lowering a threshold requires a separate PR with a measured baseline, an
explanation of the lost coverage, and reviewer approval. CI uploads JSON,
LCOV, and HTML reports as `coverage-report` for seven days.

## Accessibility ratchet

`@axe-core/playwright` scans login, dashboard, customer list, customer detail,
calendar, and schedule-change requests in desktop 1440x900 and mobile 390x844.
It waits for a page-specific visible landmark, disables motion in the test
page, waits for fonts, and checks WCAG 2.0/2.1 A and AA tags.

The initial synthetic-data scan found 22 violation rules across the 12 page
scenarios and 28 critical/serious target nodes. Those existing signatures are
recorded in `quality/accessibility-baseline.json`. Removing a baseline issue is
allowed. A new critical/serious signature or an increase in an existing
signature count fails CI. Other impacts and the existing absolute count remain
advisory and are included in the safe JSON report.

The baseline stores only rule ID, impact, a redacted selector, and a selector
hash. It does not store HTML, cookies, tokens, customer names, phone numbers,
or consultation text. Blanket page exclusion and broad rule disabling are not
allowed. Updating the baseline requires `test:e2e:accessibility:update`, a
review of every added signature, and explicit reviewer approval.

CI uploads `accessibility-summary` and sanitized Playwright failure artifacts
for seven days. The stable check name is `accessibility`.

## Bundle growth budget

Vite emits `.vite/manifest.json`. `scripts/check-bundle-budget.mjs` maps the
entry through that manifest, scans all generated JS/CSS, and calculates raw and
gzip level-9 bytes. Source maps are not generated or uploaded.

The main SHA `04be567` baseline is:

| Metric | Raw | Gzip |
| --- | ---: | ---: |
| Main entry JS | 885.3 KiB | 165.8 KiB |
| Largest JS chunk | 699.0 KiB | 232.8 KiB |
| Total JS | 3,207.5 KiB | 786.7 KiB |
| Total CSS | 232.6 KiB | 32.5 KiB |

Each gzip metric may grow by at most 5%. Absolute fallback ceilings are 50 KiB
for entry/largest chunk, 100 KiB for total JS, and 20 KiB for total CSS; the
stricter relative or absolute limit wins. Current absolute size and Vite's
large-chunk warning are advisory debt, not a reason to weaken the growth gate.

Two consecutive Windows production builds produced byte-identical metrics.
The Linux `bundle-budget` job independently builds and checks the same budget,
then uploads `bundle-budget-summary` for seven days.

## CI and exceptions

Stable job names are `coverage`, `bundle-budget`, and `accessibility`. Blocking
jobs must not use `continue-on-error`, `|| true`, or zero-test success paths.
Budget exceptions require a focused PR that explains the product need,
measures the increase, updates the relevant baseline, and records reviewer
approval. Branch protection settings remain an administrator action outside
this PR.

Future tightening should first remove existing axe findings, raise coverage in
security/RBAC modules, and split the current large entry/vendor chunks. Do not
raise thresholds until the corresponding improvement is merged and measured.
