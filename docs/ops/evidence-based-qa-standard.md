# Evidence-Based QA Standard

BOA CRM reviews are evidence-first. A claim is not complete until the proof is named.

## Evidence To Collect

Use evidence appropriate to the task:
- file paths and line references
- command results
- screenshots
- Playwright traces or browser checks
- reproduction steps
- API inputs/outputs
- role matrix
- deployment commit and environment status

## UI Evidence

When UI is involved, prefer:
- desktop screenshot
- mobile screenshot
- route names
- viewport sizes
- interaction state evidence
- loading/empty/error/forbidden state proof when relevant

If screenshots are not taken, say why.

## Browser and Playwright Verification

Use browser-based checks when:
- route rendering changes
- responsive behavior changes
- navigation changes
- high-risk UI states change
- release readiness is claimed

For docs-only tasks, browser tests are normally not required.

## Test Commands and Results

Common local verification:
- `pnpm.cmd check`
- `pnpm.cmd test`
- `pnpm.cmd build`
- `pnpm.cmd test:e2e` when routing, UI, e2e, or smoke behavior is touched

Report:
- command
- pass/fail
- key failure line only
- rerun result for flaky failures

## Reproduction Steps

Bug reports should include:
- starting role/account
- route or API
- input data
- expected behavior
- actual behavior
- logs or screenshots
- whether web notification, FCM push, database state, or UI state is being discussed

## Claims Not Allowed Without Proof

Do not claim these without direct evidence:
- production deployed
- Railway live behavior works
- Android push received
- RBAC safe
- mobile usable
- no customer data exposed
- migration safe
- performance acceptable

## Default Verdict Rules

PASS:
- Required evidence exists.
- No P0/P1 remains.
- Required checks pass.
- External limitations are clearly separated.

NEEDS WORK:
- Evidence is incomplete.
- P2 issues remain that affect normal work.
- Tests are missing for changed behavior.

HOLD:
- P0/P1 remains.
- Customer data exposure risk remains.
- RBAC is uncertain.
- Required tests fail.
- Destructive DB risk is unresolved.
