# BOA CRM Codex Operating Rules

## 1. Repository Boundaries

This repository is `raonis/boa` or `raonisi/boa`. Before editing, confirm the actual repository, branch, working tree state, and task type.

BOA CRM is an internal insurance sales CRM. Preserve the existing architecture, routes, database schema style, auth flow, UI conventions, and role hierarchy. Do not rebuild the project from scratch.

## 2. Safety / RBAC / Data Rules

Security, RBAC correctness, and customer-data protection come first.

- Keep DB/API enum values in English: `branch_admin`, `sub_branch_admin`, `team_leader`, `member`, `inactive`, `resigned`.
- Use Korean labels only through UI display helpers.
- Server-side authorization is required. Front-end hiding alone is not enough.
- Direct URL/API access outside role scope must return `FORBIDDEN` or `BAD_REQUEST`.
- Never weaken RBAC checks or expose customer data across branch/team/member scope.
- Do not add resident registration numbers, policy/certificate numbers, ID-card upload, detailed illness history, or plaintext password storage.
- Phone numbers and birthdates may remain visible in authorized operational work screens when required.
- Masking may be used in activity logs, audit logs, exports, operation-risk logs, DATA_DOWNLOAD metadata, push payloads, and non-operational views.
- Push titles/bodies must not include customer names, phone numbers, illness details, product names, premiums, tokens, or credentials.
- Customer/contract permanent delete is a controlled `branch_admin` feature. Do not remove it, convert it to archive-only, or delete `activity_logs` unless explicitly requested.

See [RBAC and Customer Data Safety Standard](docs/ops/rbac-safety.md).

## 3. Task Planning Rules

Reduce waste, not quality.

Token savings may remove duplicated exploration, broad scans, and long logs. It must never reduce correctness, security, RBAC validation, customer-data protection, required testing, or final verification.

- Use a single-agent workflow by default.
- Before editing, list likely affected files first.
- Start with 5 or fewer files when possible.
- Expand scope only when correctness, safety, RBAC, DB/API integrity, customer-data protection, or tests require it.
- When expanding scope, explain why in 1-2 short lines.
- Keep changes small and reviewable.
- Do not perform full-codebase audits unless the task explicitly requires one.

See [Codex Workflow Standard](docs/ops/codex-workflow.md).

## 4. Editing Rules

- Do not change product code, DB, API, RBAC, UI, tests, package scripts, or dependencies unless the current task explicitly asks for it.
- Preserve existing project structure and local patterns.
- Do not refactor unrelated code.
- Do not redesign unrelated UI.
- Do not commit secrets, `.env`, real customer data, API keys, database passwords, Firebase keys, production CSVs, APK/AAB files, JKS/keystores, `google-services.json`, Firebase Admin SDK JSON, or `local.properties`.
- Never directly mutate production DB state, reset/drop/truncate production DB, or perform manual production hard deletes.

## 5. Testing Rules

Run checks appropriate to the change and do not skip required verification to save tokens.

Preferred baseline:

- `pnpm.cmd check`
- `pnpm.cmd test`
- `pnpm.cmd build`
- `pnpm.cmd test:e2e` when e2e, routing, dev server, or smoke behavior is touched

For docs-only changes, `pnpm.cmd check` is normally enough. If test/build is skipped, state why in the final report.

See [E2E and Playwright Standard](docs/ops/e2e-playwright-standard.md).

## 6. PR Report Rules

Keep reports concise and evidence-based. Mention changed files, runtime behavior, DB/API/RBAC impact, tests run, failed tests, known limits, rollback, and the next recommended task when useful.

Use [PR Report Template](docs/ops/pr-report-template.md) for handoff summaries.

## 7. When to Use Parallel Agents

Default to single-agent work.

Use limited parallel agents only when the task touches multiple risk areas such as role-specific behavior, RBAC, customer data display/masking, DB assignment, notifications, activity/audit logs, or release/security-wide review.

Parallel agents must have bounded responsibilities and must not edit the same files simultaneously. Reporting agents should not directly modify code. The final orchestrator owns the final diff.

See [Parallel Agent Policy](docs/ops/parallel-agent-policy.md).

## 8. Do Not Touch

Unless explicitly requested, do not change:

- product runtime behavior
- DB schema, migrations, or production data
- API contracts or RBAC policy
- UI design system or broad layout
- test logic unrelated to the task
- `package.json`, lockfiles, or dependencies
- generated, build, cache, APK/AAB, keystore, or local config files

## 9. Required Final Report

For implementation or docs cleanup:

```text
Scope:
Changed files:
Summary:
Tests:
Manual verification:
Notes:
PR 제목/URL:
```

For review or audit:

```text
Scope:
P0:
P1:
P2:
P3:
Tests / checks:
Recommended next action:
```

## 10. Reference Docs

- [Codex Workflow Standard](docs/ops/codex-workflow.md)
- [RBAC and Customer Data Safety Standard](docs/ops/rbac-safety.md)
- [UI/UX Review Standard](docs/ops/ui-ux-review-standard.md)
- [E2E and Playwright Standard](docs/ops/e2e-playwright-standard.md)
- [PR Report Template](docs/ops/pr-report-template.md)
- [Parallel Agent Policy](docs/ops/parallel-agent-policy.md)
