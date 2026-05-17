# AGENTS.md — BOA Insurance CRM Repository Rules

## 1. Project Identity

This repository is `raonis/boa` or `raonisi/boa`.

Before editing, confirm:
- actual repository name
- current branch
- working tree state
- task type: small hotfix, scoped feature change, PR review, full audit, or security/RBAC-sensitive change

BOA CRM is an internal Korean insurance sales CRM used for:
- customer management
- DB assignment and recall
- owner/assignee management
- consultation tools
- consultation scripts
- checklists
- message templates
- activity logs
- notifications
- branch/team operations
- role-based access control
- sales performance and pipeline reporting
- operation risk management
- Android internal app / Capacitor workflow

---

## 2. Highest Priority Rule

Quality, correctness, security, and completion always come before token savings.

Token optimization is allowed only when it removes waste.

Token optimization must never reduce:
- implementation completeness
- reasoning quality
- RBAC verification
- customer-data protection
- API/DB validation
- test coverage
- required file inspection
- security checks
- final verification

Start small, but expand scope when correctness, safety, RBAC, DB/API integrity, customer-data protection, or tests require it.

When expanding scope, briefly explain why.

Final rule:

```text
Reduce waste, not quality.
```

---

## 3. Priority Order

When instructions conflict, follow this order:

1. Security, customer data protection, and RBAC correctness
2. Correct implementation of the requested task
3. Required tests, build checks, and verification
4. Preservation of existing architecture, auth flow, database style, routes, and UI conventions
5. Minimal localized changes
6. Token budget optimization
7. Concise final reporting

---

## 4. Core Roles

Internal enum values must remain unchanged.

| Internal value | Korean UI label | Meaning |
|---|---|---|
| `branch_admin` | 지점장 | Final branch admin, full access |
| `sub_branch_admin` | 부지점장 | Deputy manager, subordinate scope only |
| `team_leader` | 팀장 | Team leader, own team scope only |
| `member` | 팀원 | Own assigned data only |
| `inactive` | 비활성 | Protected access blocked |
| `resigned` | 퇴사자 | Protected access blocked |

Never change DB/API enum values to Korean labels.

Use display helpers for UI labels.

---

## 5. Non-Negotiable Workflow

- Do not rebuild the project from scratch.
- Preserve existing architecture, routes, DB style, auth flow, UI conventions, and RBAC.
- Before editing, list likely affected files first.
- Start with 5 or fewer likely affected files when possible.
- Expand only when required for correctness, RBAC, security, DB/API integrity, or tests.
- Make small, reviewable changes.
- Prefer fixing the requested issue over improving unrelated code.
- Do not refactor unrelated code.
- Do not redesign unrelated UI.
- Run the smallest relevant check first.
- Never commit secrets, `.env`, real customer data, API keys, database passwords, Firebase keys, production CSVs, APKs, keystores, or local Android config files.

---

## 6. Agent Selection Rules

### 6.1 Single-Agent Workflow

Use single-agent by default.

Use for:
- button errors
- save failures
- edit/delete not working
- isolated CRUD repair
- single-screen UI fixes
- form validation fixes
- copy/text changes
- logo/simple asset application
- specific test failure fixes
- low-risk modal, spacing, and layout adjustments

Rules:
- inspect the smallest relevant area
- list affected files before editing
- avoid full-repo audits
- keep changes minimal
- run relevant checks

Output:

```text
Scope:
Changed files:
Summary:
Tests:
Manual verification:
Notes:
```

---

### 6.2 Limited Parallel-Agent Workflow

Use limited parallel agents when the task affects multiple risk areas.

Use for:
- role-specific behavior differences
- RBAC or permission-sensitive changes
- customer data display or masking
- DB assignment, recall, owner, or assignee logic
- branch/team hierarchy changes
- notification delivery or preferences
- activity log or audit log behavior
- API + UI + permission changes together
- PR review before merge

Use at most 3 agents unless explicitly requested:

1. Product/UX Agent
2. Backend/RBAC Agent
3. QA/Test Agent

Rules:
- keep each agent scope bounded
- avoid overlapping file reads
- avoid broad repository exploration
- final integrator makes code changes
- use agents only when they improve correctness or safety

Agent roles:

```text
Product/UX Agent:
Validate user flow, screen behavior, CTA, empty/loading/error state, and operational usability.

Backend/RBAC Agent:
Validate API contract, server authorization, role scope, branch/team hierarchy, DB/API impact, and customer-data safety.

QA/Test Agent:
Identify required tests, role scenarios, regression risks, and verification commands.
```

Output for review/audit:

```text
Scope:
P0:
P1:
P2:
P3:
Tests / checks:
Recommended next action:
```

Output for implementation:

```text
Scope:
Affected areas:
Implementation summary:
Changed files:
Tests:
Manual verification:
Risks / follow-up:
```

---

### 6.3 Full Audit Workflow

Use full audit only for broad verification.

Use for:
- full CRM feature review
- release readiness check
- monthly quality review
- security/customer-data exposure review
- full UI/UX audit
- repository-wide architecture or risk review
- large release after multiple PR merges

Rules:
- diagnosis-first, not implementation-first
- do not edit code unless explicitly requested
- report actionable issues only
- classify by P0/P1/P2/P3
- avoid generic advice

Severity:
- P0: immediate fix; security, data loss, broken auth, production blocker
- P1: fix before merge/release
- P2: fix next sprint
- P3: improvement or cleanup

Output:

```text
Scope:
P0:
P1:
P2:
P3:
Tests / checks:
Recommended next action:
```

---

## 7. Practical Decision Table

| Work type | Default workflow |
|---|---|
| Button bug, save failure, delete/edit not working | Single-agent |
| Specific CRUD repair | Single-agent |
| Single-screen UI polish | Single-agent |
| Logo/simple branding asset | Single-agent |
| DB assignment or assignee logic | Single-agent first; limited parallel if RBAC/API/UI interact |
| Bulk owner/assignee changes | Limited parallel |
| Notification, RBAC, DB, or audit-log work | Limited parallel |
| Customer phone/birthdate display or masking | Limited parallel |
| Activity log redaction | Limited parallel |
| PR pre-merge review | Limited parallel |
| Full CRM UI/UX audit | Full audit |
| Security, permission, customer-data exposure full check | Full audit or limited parallel by area |

Decision rule:

```text
Feature-level issue = single-agent.
Role, DB, API, log, notification, assignment, or customer-data issue = limited parallel-agent.
Release, full UI/UX, or security-wide issue = full audit.
```

---

## 8. Safety Rules

- No Korean resident registration number fields.
- No ID-card upload.
- No detailed illness history field.
- No plaintext password storage.
- Server-side authorization is required.
- Front-end hiding alone is not enough.
- Direct URL/API access outside role scope must return `FORBIDDEN` or `BAD_REQUEST`.
- Never weaken RBAC checks.
- Never expose customer data to unauthorized roles.
- Never log secrets, tokens, credentials, or unnecessary customer details.
- Never add console logs containing customer phone numbers, birthdates, IDs, consultation details, tokens, secrets, or credentials.
- Preserve branch/team hierarchy rules.
- DB/API/RBAC/permission changes require a short reason before editing.

---

## 9. Permanent Delete Policy

Direct production DB destructive actions are forbidden:
- no direct production DB reset
- no direct production DB drop
- no direct production DB truncate
- no direct manual production DB hard delete

The CRM product allows controlled customer/contract permanent delete as a high-risk `branch_admin` feature through approved CRM UI/API flow.

Allowed only when safeguards are preserved:
- `branch_admin` only
- server-side authorization
- confirmation flow
- reason required
- irreversible action warning
- safe activity log record
- no sensitive customer details in activity log metadata
- no deletion of `activity_logs`
- no unauthorized direct API bypass

Do not remove customer/contract permanent delete unless explicitly requested.

Do not convert it to archive-only unless explicitly requested.

Do not hard delete meaningful logs.

---

## 10. Customer Data Display Rules

- Korean resident registration numbers are forbidden.
- Birthdate and phone number may remain visible in operational work screens when required by product behavior.
- Operational work screens include customer list, customer detail, assigned DB views, follow-up screens, schedules, mobile customer cards, and call-related screens.
- Do not remove required operational customer fields from staff workflows unless explicitly requested.
- Masking may be applied in activity logs, audit logs, exports, logs, operation-risk logs, DATA_DOWNLOAD metadata, push payloads, or non-operational views when required.
- Do not include customer names, phone numbers, illness details, product names, or premium amounts in push notification titles/bodies.
- Tokens, secrets, credentials, and keys must never appear in UI, logs, screenshots, final output, or commits.

---

## 11. Token Budget Rules

Token optimization means:
- avoid unrelated files
- avoid duplicated searches
- avoid unnecessary full-repo audits
- avoid long logs
- avoid verbose reports
- avoid broad refactoring unrelated to the task
- avoid reading generated files, build outputs, coverage files, lock files, and old migrations unless necessary

Token optimization does not mean:
- doing less work
- lowering implementation quality
- weakening RBAC validation
- avoiding API/DB checks
- skipping related files
- skipping tests
- avoiding needed subagents

Rules:
- do not perform full-codebase analysis unless explicitly requested or required
- list affected files before editing
- start with 5 or fewer likely files when possible
- expand only when required, and explain briefly
- avoid broad searches when targeted search is enough
- do not paste full test logs
- summarize pass/fail and key errors only
- keep final responses concise but complete

---

## 12. Testing Rules

Run the smallest relevant check first.

Preferred order:
1. Type check for affected area
2. Related unit test
3. Related integration/API test
4. Related UI test
5. Full test
6. Build check

Run broader checks when:
- shared logic is affected
- auth is affected
- RBAC is affected
- customer data exposure is affected
- DB/API contracts are affected
- assignment, recall, ownership, or branch/team hierarchy is affected
- task is before PR merge
- user explicitly requests full verification

Do not skip required tests to save tokens.

When tests fail:
- report the failing command
- include key error lines only
- identify related vs pre-existing failure
- fix only current-task failures unless asked otherwise

---

## 13. Permission Rules

- Never weaken RBAC checks.
- Never assume every user can view every customer.
- Never assume branch/team hierarchy can be bypassed.
- Verify `branch_admin`, `sub_branch_admin`, `team_leader`, and `member` separately when touching permissions.
- `inactive` and `resigned` users must be blocked from login and protected API access.
- Direct URL/API access outside role scope must be denied.
- Do not expose branch-level data to team-only users.
- Do not expose unrelated team data to members.
- Preserve assigned DB and subordinate organization boundaries.

---

## 14. Feature Rules

### Customer Management

- Bulk DB assignment should remain efficient.
- DB recall must preserve ownership, assignment history, and activity integrity.
- Owner/assignee changes must not break branch/team hierarchy.
- Verify role-specific behavior when assignment auto-sets assignee.
- Assignment from `branch_admin` to staff may auto-set assignee when required.
- Assignment from `branch_admin` to `sub_branch_admin` or `team_leader` should not force final staff assignee unless explicitly required.
- Preserve filters, search, selection, assignment, recall, owner/assignee, and bulk operation usability.
- Authorized staff must retain operational phone/birthdate visibility when required.

### Consultation Tools

- Scripts, checklists, and message templates should support consistent CRUD when role allows.
- Edit, delete, deactivate, restore, and visibility must be clear.
- Preserve existing design and layout.
- Verify role-specific create/edit/delete permissions.

### Activity Logs

- Preserve auditability.
- Do not delete meaningful logs.
- Do not add noisy logs.
- Do not log secrets, tokens, credentials, or unnecessary customer details.
- Activity logs may use masking where required.
- Operational work screens may preserve phone/birthdate fields when required.
- Do not apply activity-log masking globally to operational customer screens unless requested.

### Notifications

- Do not change delivery rules unless task targets notifications.
- Verify settings, recipient roles, and event triggers when touching notifications.
- Do not create duplicate notifications.
- Do not expose notifications across unauthorized branch/team boundaries.
- Do not include customer names, phone numbers, illness details, product names, or premiums in push title/body.

### Branch / Team Operations

- Preserve branch/team hierarchy.
- Do not allow members to manage branch-level settings.
- Do not allow `team_leader` or `sub_branch_admin` to exceed assigned scope.
- DB assignment, recall, owner, and assignee changes require role-based tests.

---

## 15. UI Rules

- Preserve current BOA CRM design system.
- Use existing components and layout patterns first.
- Do not introduce a new UI library unless requested.
- Admin screens should be practical, scannable, and dense enough for operations.
- CRM tables must preserve search, filter, selection, assignment, recall, owner/assignee, and bulk operation usability.
- Forms must preserve validation, loading, disabled, empty, and error states.
- Destructive actions must preserve confirmation flow.
- Do not redesign a screen when asked only for a functional fix.
- Do not change global styling for a local issue.
- If shared components must be touched, explain why before editing.

---

## 16. Database / API Rules

- Do not change DB schema unless required.
- Do not create migrations unless necessary.
- Do not rewrite old migrations unless explicitly requested.
- Do not change API contracts unless necessary.
- If DB/API changes are required, explain the reason before editing.
- Preserve backward compatibility where possible.
- Keep validation on both client and server when relevant.
- Do not rely on client-side validation alone.
- Preserve `FORBIDDEN` and `BAD_REQUEST` semantics.
- Do not expose internal errors to unauthorized users.

---

## 17. Security Rules

- Never commit secrets.
- Never print secrets.
- Never expose `.env` values.
- Never store plaintext passwords.
- Never add insecure test shortcuts to production code.
- Never bypass auth or authorization.
- Never use real customer data in tests or examples.
- Never commit production CSVs or credentials.
- Treat tokens, service role keys, DB URLs, OAuth secrets, and Firebase Admin keys as sensitive.
- Never commit APK, AAB, JKS, keystore, `google-services.json`, Firebase Admin SDK JSON, or `local.properties`.

---

## 18. Cursor / Local Development

Services:
- `pnpm dev`: Express + Vite dev server on port 3000
- local MySQL: Docker `mysql:8.0`
- migrations: `pnpm db:migrate`

Commands:
- `pnpm check`
- `pnpm test`
- `pnpm build`
- `pnpm db:migrate`

Known notes:
- `pnpm check` may have pre-existing errors in `server/mobileRoutes.ts`.
- Tests normally use in-memory mocks unless database behavior is explicitly targeted.
- Do not treat unrelated pre-existing errors as part of the current task unless they block it.
- If esbuild binary is missing, run `pnpm rebuild esbuild`.

Health check:

```text
GET /api/health
```

Expected:

```json
{"ok":true,"service":"boa-crm"}
```

---

## 19. Review and Audit Rules

For implementation/hotfix:
- fix requested issue
- keep changes small
- run relevant checks
- summarize changed files and verification

For PR review:
- review changed files first
- expand only when required for correctness/safety
- report by severity
- do not rewrite code unless asked

For full audit:
- use P0/P1/P2/P3
- focus on actionable issues
- avoid generic advice
- include verification steps
- do not produce a long theoretical report

---

## 20. Required Final Response Format

Implementation/hotfix:

```text
Scope:
Changed files:
Summary:
Tests:
Manual verification:
Notes:
```

PR review/full audit:

```text
Scope:
P0:
P1:
P2:
P3:
Tests / checks:
Recommended next action:
```

Large feature work:

```text
Scope:
Affected areas:
Implementation summary:
Changed files:
Tests:
Manual verification:
Risks / follow-up:
```

Keep final responses concise by default.

Do not omit critical risks, required verification, or failed checks just to shorten the response.

Do not include unrelated suggestions.

---

## 21. First Response Behavior

At the start of a task:

- Restate exact task scope in one short sentence.
- List likely affected files first.
- Say task type:
  - small hotfix
  - scoped feature change
  - PR review
  - full audit
  - security/RBAC-sensitive change
- Do not edit files until likely affected area is identified.
- Ask a question only when a missing requirement would cause incorrect implementation.

---

## 22. Final Reminder

BOA CRM is an operational insurance CRM with customer data, role hierarchy, assignment logic, consultation records, activity logs, notifications, and audit-sensitive workflows.

Do not optimize tokens at the expense of:
- correctness
- customer data safety
- RBAC
- DB/API integrity
- tests
- real operational usability
- Codex capability
- implementation completeness

Final rule:

```text
Reduce waste, not quality.
```
