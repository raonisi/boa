# CI Quality Gate Policy

## Required checks

BOA CRM pull requests must pass these stable GitHub Actions checks before merge:

- `check`
- `unit-test`
- `build`
- `e2e-critical`

The same workflow runs after a push to `main`. The workflow uses read-only
repository permissions and does not use `pull_request_target` or production
secrets.

## Branch protection recommendation

- Block direct pushes to `main`; merge through pull requests.
- Require all four checks above.
- Require the branch to be current with `main` before merge.
- Dismiss stale approvals when new commits are pushed.
- Do not allow administrator bypass for normal product changes. Emergency
  bypasses should be exceptional, documented, and followed by a retrospective.

Repository settings are not changed by PR-QA-GATE-01. An administrator must
apply these branch protection rules after this workflow is merged and its
check names have appeared in GitHub.

## Critical E2E isolation

`e2e-critical` creates a disposable MySQL 8.0 service for each workflow run,
applies all Drizzle migrations, and inserts synthetic `[TEST]` users,
customers, schedules, and hierarchy data. The seed command refuses any host
other than localhost and any database name other than `boa_e2e`.

Role sessions are signed in Playwright global setup with the existing server
session primitive. No login bypass endpoint, client-side role override, Google
OAuth account, Aiven database, Railway environment, Firebase credential, or
real customer record is used. Storage-state files are ignored by Git and
removed in global teardown.

The critical suite runs Chromium headlessly with one worker. CI retries once.
Failures retain screenshots, videos, and traces. Before upload, a mandatory
sanitizer removes JWTs, session-cookie values, and database URLs from both
plain report files and ZIP-based traces. Artifacts are retained for seven days.

## Covered release risks

The browser gate verifies organization schedule visibility for all active
roles, server-side denial of unauthorized direct schedule mutations, scoped
schedule-change requests, branch-admin approval and automatic application,
duplicate approval denial, and optimistic-concurrency conflict handling.

Full browser matrices, Android devices, production OAuth, Google Calendar,
Firebase delivery, accessibility blocking, and production database tests are
separate release activities and are not part of this gate.
