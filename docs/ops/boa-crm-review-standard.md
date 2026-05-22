# BOA CRM Review Standard

Use this framework for reviews, audits, release checks, and merge decisions. Keep the review proportional to the risk.

## Review Levels

### Quick Review
- Scope: docs, copy, narrow UI, or low-risk helper changes.
- Evidence: changed files, focused diff, one relevant check.
- Output: verdict, risks, remaining work.

### Feature Review
- Scope: new workflow, API behavior, UI behavior, or notification behavior.
- Evidence: role impact, happy path, edge cases, tests, UI proof if visual.
- Output: score when useful, P0/P1/P2/P3 issues, tests, rollout notes.

### Hotfix Review
- Scope: urgent production bug, notification gap, auth/RBAC defect, or deployment issue.
- Evidence: root cause, minimal fix, regression test, rollback path.
- Output: merge readiness and production verification boundary.

### Full Operational Audit
- Scope: cross-module behavior, branch workflow, notifications, RBAC, DB, mobile, or deployment.
- Evidence: route/API map, role matrix, tests, screenshots, known external gaps.
- Output: operational verdict and prioritized remediation plan.

### Pre-release Audit
- Scope: readiness for broader branch/team use.
- Evidence: check/test/build, e2e when relevant, mobile smoke, RBAC, DB/migration, deployment plan, rollback.
- Output: go/no-go decision.

## Required Output

Every review should include:
- final verdict
- score, if useful
- P0/P1/P2/P3 issues
- evidence
- changed files
- tests or checks run
- risks
- remaining work

Use `docs/ops/pr-final-report-template.md` for full handoffs. Use `docs/ops/pr-report-template.md` only for short legacy PR summaries.

## Severity

- P0: must not deploy. Data exposure, auth bypass, destructive DB risk, or production outage.
- P1: must fix before merge or release. Broken core workflow, missing RBAC guard, failed required tests.
- P2: should fix soon. Usability gap, partial edge case, insufficient evidence, or performance concern.
- P3: polish, copy, or documentation improvement.

## Verdict Labels

- Pilot usable: Works for a narrow test group with known limitations and close monitoring.
- Team usable: Works for normal team workflows with no known P0/P1 and acceptable P2 risk.
- Organization usable: Works across branch roles with RBAC evidence, mobile evidence, and operating docs.
- Production safe: No P0/P1, required tests pass, rollback is known, deployment risks are understood, and customer-data exposure is controlled.

## Review Discipline

- Do not declare production safe from local tests alone.
- Separate GitHub merge state from Railway live deployment state.
- Separate web notification-center behavior from Android FCM delivery behavior.
- Separate code presence from real-device proof.
- For UI work, provide screenshots or clearly state that visual verification was not performed.
