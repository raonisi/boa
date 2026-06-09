# BOA CRM Pre-Pilot Real-Use Verification Checklist

This checklist is the final operator-facing verification gate before controlled pilot usage.

Use only safe `[TEST]` data for write tests. Do not use real customer data for create, update, delete, merge, handoff, contract, consultation, follow-up, schedule, or notification tests.

**Flutter APK pilot (limited rollout):** before distributing a release APK to field pilot users, complete [FLUTTER_APK_PILOT_DEPLOYMENT_CHECKLIST.md](./FLUTTER_APK_PILOT_DEPLOYMENT_CHECKLIST.md) in addition to this checklist. Do not commit APK/AAB, keystores, or `google-services.json`.

Required test customer name:

```text
[TEST] 파일럿 검수 고객
```

## Result Legend

- `[ ]` Not checked
- `[x]` Passed
- `[!]` Needs follow-up
- `[BLOCKED]` Pilot-blocking issue

## A. Environment And Repository Safety

- [ ] Repository is confirmed as `raonisi/boa`.
- [ ] Any feature or QA edit is made on a non-`main` branch.
- [ ] `git status --short` is checked before staging.
- [ ] Unrelated dirty files are excluded from staging.
- [ ] `git add .` is not used.
- [ ] No `.env` or local secret files are staged.
- [ ] No APK, AAB, JKS, keystore, `google-services.json`, Firebase Admin JSON, or `local.properties` files are staged.
- [ ] No real customer data file, production CSV, token, credential, DB URL, OAuth secret, JWT/session data, or Firebase key is staged.
- [ ] `pnpm.cmd check` completed.
- [ ] `pnpm.cmd test` completed when runtime behavior changed.
- [ ] `pnpm.cmd build` completed when runtime behavior changed.
- [ ] `pnpm.cmd test:e2e` completed when routing, dev server, mobile smoke, or Playwright-covered behavior changed.

## B. Deployment Safety

- [ ] Merge to `main` happens only after PR review and required checks pass.
- [ ] Railway deploy uses **Deploy Latest Commit** for the intended `main` commit.
- [ ] Failed old commits are **not** redeployed.
- [ ] Railway Build Command is verified if deployment is involved.
- [ ] Railway Pre-Deploy Command is verified if deployment is involved.
- [ ] Railway Start Command is verified if deployment is involved.
- [ ] DB migration logs are checked only when a migration exists.
- [ ] No production DB reset, drop, truncate, or manual hard delete is performed.
- [ ] Production hard delete is not tested during pilot verification.

### Railway Dashboard Baseline (no `railway.json` / `railway.toml` in repo)

The repository does not commit Railway service config files. Use the Railway Dashboard settings below as the deployment source of truth.

| Step | Command |
| --- | --- |
| Build Command | `pnpm install && pnpm build` |
| Pre-Deploy Command | `pnpm db:migrate` |
| Start Command | `pnpm start` |

Operator rules:

- Run `pnpm db:migrate` only through the Railway **Pre-Deploy Command** unless an approved runbook says otherwise.
- After merging a PR that includes DB migrations, confirm Railway deploy logs show `pnpm db:migrate` success before treating the release as healthy.
- If a deploy fails, use **Deploy Latest Commit** on the intended commit. Do not redeploy an older failed deployment artifact.
- Do not reset, drop, truncate, or manually hard delete production DB data during deploy verification.

### Railway PORT Binding

- In Railway/production, the server binds only to the assigned `PORT` from the platform.
- The server does not fall back to another port when `NODE_ENV=production` or Railway environment markers are present.
- If the assigned port cannot be bound, the process fails fast so Railway health checks do not route to the wrong port.
- Local development may still scan for the next available port when the preferred port is busy.

## C. Role And RBAC Smoke

- [ ] `branch_admin` can access allowed admin functions.
- [ ] `sub_branch_admin` sees only assigned subordinate scope.
- [ ] `team_leader` sees only own team scope.
- [ ] `member` sees only assigned customers and own-scope operational data.
- [ ] `inactive` and `resigned` accounts are blocked from login and protected APIs.
- [ ] Direct URL/API access outside role scope is blocked with `FORBIDDEN` or `BAD_REQUEST`.
- [ ] Front-end hiding is not treated as the only authorization layer.
- [ ] Branch-admin-only actions do not appear as usable controls for unauthorized roles.

## D. Customer Workflow Smoke Using Test Data Only

- [ ] Create `[TEST] 파일럿 검수 고객`.
- [ ] Open the test customer detail page.
- [ ] Edit consultation status for the test customer.
- [ ] Add a consultation record for the test customer.
- [ ] Update priority, tag, or next action if available.
- [ ] Use a consultation checklist if available.
- [ ] Copy a message template if available.
- [ ] Create a follow-up for the test customer.
- [ ] Complete or postpone the test follow-up.
- [ ] Create a schedule for the test customer.
- [ ] Complete the test schedule.
- [ ] Create a test contract for the test customer.
- [ ] Check branch_admin own DB, own contract, and own performance scope if applicable.
- [ ] Clean up test data with soft delete or safe test-only cleanup.
- [ ] Do not perform production hard delete.

## E. Contract Workflow Smoke

- [ ] Create a test contract for `[TEST] 파일럿 검수 고객`.
- [ ] Verify new contract count display.
- [ ] Verify monthly premium display.
- [ ] Request contract delete if the role flow requires it.
- [ ] As branch_admin, approve or reject the delete request only when using test data.
- [ ] Restore flow is checked only with test data if applicable.
- [ ] No policy or certificate number is added.
- [ ] No policy or certificate number is exposed.

## F. Follow-Up And Schedule Workflow Smoke

- [ ] Today follow-up appears where expected.
- [ ] Overdue follow-up appears where expected.
- [ ] Follow-up complete works.
- [ ] Follow-up postpone works.
- [ ] Schedule appears on calendar.
- [ ] Schedule complete works.
- [ ] Dashboard TodayWorkSection mobile quick tasks render if present.
- [ ] MobileTaskSheet opens without overflow if present.
- [ ] Complete, postpone, cancel, confirm, customer detail, and counseling navigation remain clear where available.

## G. Notifications And Push Safety

- [ ] Notification list is visible.
- [ ] Mark read works if implemented.
- [ ] Process complete works if implemented.
- [ ] Push titles and bodies do not contain customer name, phone, illness, product name, premium, token, or credential.
- [ ] Raw device token values are not visible in UI.
- [ ] Raw device token values are not visible in logs shown to operators.
- [ ] Branch-admin-only push operations remain protected if implemented.
- [ ] Quiet hours and preferences are checked if implemented.

## H. Admin Risk Workflows

- [ ] DeletedDataManagement is visible only to allowed roles.
- [ ] Restore action is protected and logged.
- [ ] Permanent delete remains branch_admin-only.
- [ ] Permanent delete requires reason and explicit confirmation.
- [ ] Permanent delete is not tested on production data.
- [ ] UserHandoffManagement source and target user flow is readable.
- [ ] Handoff execution remains role-appropriate.
- [ ] CustomerMergeManagement source and target distinction is clear.
- [ ] Merge is tested only with safe test data if needed.
- [ ] `activity_logs` are not deleted.
- [ ] Activity log and audit policy are unchanged.

## I. Performance And Goals Smoke

- [ ] Performance summary is visible.
- [ ] 신규 계약 is visible.
- [ ] 월납보험료 실적 is visible.
- [ ] Goal dashboard is visible.
- [ ] Goal create role boundary is preserved.
- [ ] Goal edit role boundary is preserved.
- [ ] Goal deactivate role boundary is preserved.
- [ ] Work rhythm summary is visible if implemented.
- [ ] No 유지/미유지 metric is added unless already part of current policy.

## J. Mobile Usability Smoke

- [ ] Dashboard mobile has no horizontal scroll.
- [ ] Customer list mobile cards are readable.
- [ ] Customer detail mobile primary actions are reachable.
- [ ] Contract list mobile cards are readable.
- [ ] Calendar mobile controls are usable.
- [ ] Notification mobile actions are tappable.
- [ ] Consultation tools tabs, cards, and copy actions are usable.
- [ ] Performance and goals cards are readable.
- [ ] User management role/status cards are readable.
- [ ] Deleted data, handoff, and merge high-risk actions are visually separated.
- [ ] Activity/audit/operation risk mobile views keep masking and do not expose secrets.
- [ ] Sheet and Dialog content does not overflow the viewport.
- [ ] Primary mobile action buttons have safe tap targets where changed.
- [ ] Bottom navigation does not hide submit or confirmation actions.

## K. Final Pilot Readiness Decision

Choose one:

- [ ] PASS: pilot can proceed.
- [ ] HOLD: blocking issue exists.
- [ ] NEEDS FIX: non-blocking issue requires follow-up PR.

Decision owner:

```text
Name:
Role:
Date:
Decision:
```

## Issue Log

| Severity | Issue | Owner | Due Date | Recommended Next Action | Status |
| --- | --- | --- | --- | --- | --- |
| P0 |  |  |  |  |  |
| P1 |  |  |  |  |  |
| P2 |  |  |  |  |  |
| P3 |  |  |  |  |  |

## Severity Definitions

- P0: RBAC or customer-data exposure, production data risk, build failure, or core pilot route unusable.
- P1: Primary pilot workflow blocked, destructive action too easy to trigger, major mobile overflow, or role smoke failure.
- P2: Workflow is usable but confusing, hard to scan, or needs low-risk polish.
- P3: Minor copy, spacing, or visual consistency issue.

## Final Operator Notes

- Use only `[TEST]` data for write tests.
- Do not use real customer data for pilot verification writes.
- Do not reset, drop, truncate, or manually hard delete production DB data.
- Do not test production hard delete.
- Do not delete `activity_logs`.
- Do not export or store raw customer data outside authorized CRM workflows.
