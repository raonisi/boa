# RBAC and Customer Data Safety Standard

BOA CRM is an internal insurance sales CRM. RBAC correctness and customer-data protection have priority over speed, convenience, or token savings.

## Roles

| Internal value          | Korean label  | Access scope                    |
| ----------------------- | ------------- | ------------------------------- |
| `branch_admin`          | 지점장        | Full access                     |
| `sub_branch_admin`      | 부지점장      | Assigned subordinate scope      |
| `team_leader`           | 팀장          | Own team scope                  |
| `member`                | 팀원          | Own assigned data               |
| `inactive` / `resigned` | 비활성 / 퇴사 | Login and protected API blocked |

DB/API enum values must remain English. Korean role labels belong in UI display helpers only.

## Authorization Rules

- Server-side authorization is required.
- Front-end hiding alone is not enough.
- Direct URL/API access outside role scope must return `FORBIDDEN` or `BAD_REQUEST`.
- Do not weaken branch/team/member boundaries.
- Do not expose branch-level data to team-only users.
- Do not expose unrelated team or customer data to members.
- Preserve assigned DB and subordinate organization boundaries.
- `inactive` and `resigned` users must be blocked from login and protected API access.

## Forbidden Data Fields

Do not add:

- Korean resident registration number fields
- policy/certificate number fields
- ID-card upload
- detailed illness history fields
- plaintext password storage

## Customer Data Display

Authorized operational screens may show customer data required for work.

Phone numbers and birthdates may remain visible in:

- customer list
- customer detail
- assigned DB views
- follow-up screens
- schedules
- mobile customer cards
- call-related operational screens

Do not remove required operational customer fields unless explicitly requested.

## Masking Locations

Masking may be applied in:

- `activity_logs`
- audit logs
- exports
- operation-risk logs
- DATA_DOWNLOAD metadata
- push payloads
- non-operational views

Push notification titles and bodies must not include customer names, phone numbers, illness details, product names, premiums, tokens, secrets, or credentials.

## Permanent Delete Policy

Direct production DB destructive actions are forbidden:

- no direct production DB reset
- no direct production DB drop
- no direct production DB truncate
- no direct manual production DB hard delete

Customer/contract permanent delete is a controlled high-risk CRM feature and must not be removed unless explicitly requested.

It must remain:

- `branch_admin` only
- server-authorized
- confirmation-based
- reason-required
- clearly irreversible
- safely logged without sensitive customer details in activity log metadata

Do not delete `activity_logs`. Do not convert permanent delete to archive-only unless explicitly requested.
