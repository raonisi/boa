# RBAC Safety Checklist

Use this checklist for changes touching customers, contracts, consultations, follow-ups, schedules, notifications, exports, imports, admin actions, or user roles.

## Role Boundaries

- `branch_admin`: branch-level operations and high-risk admin workflows, with auditability for destructive/export actions.
- `sub_branch_admin`: assigned subordinate organization and DB scope only.
- `team_leader`: own team scope only.
- `member`: own assigned customer/work data only.
- `inactive` / `resigned`: blocked from login, protected APIs, and app push delivery.

## Customer Data Visibility

Allowed in authorized operational screens when needed:

- customer name
- phone number
- birthdate
- assigned workflow context

Forbidden or restricted everywhere:

- resident registration number
- policy/certificate number
- ID-card upload
- detailed illness history
- plaintext password
- raw FCM token
- secrets or credentials

Push payloads and push logs must not contain customer names, phone numbers, birthdates, illness details, product names, premiums, tokens, or credentials.

## Scope Checks

Verify server-side scope on:

- list, detail, create, update, delete, and restore APIs
- dashboard aggregates
- notifications and push candidates
- mobile routes
- imports, exports, and bulk actions
- direct URL/API access

UI filtering alone is not enough.

## Admin-only Actions

Require `branch_admin` server enforcement for:

- user role changes
- permanent delete workflows
- delete request approval
- imports and exports
- operation risk management
- push operation dashboard
- audit log access

## Bulk Import / Export Risk

Required controls:

- permission check
- reason or confirmation where applicable
- audit log
- masking or metadata redaction in logs
- no production CSV or customer data committed

## Unsafe Permission Broadening

Stop and report before:

- adding `branch_admin` fallback logic
- treating empty scope as "all"
- sharing branch aggregates with lower roles
- allowing nullable scope to widen access
- moving checks from server to frontend

## Auditability

High-risk actions should record:

- actor user id
- target type/id
- action type
- safe details
- timestamp

Do not log raw tokens, credentials, detailed illness data, product details, premiums, or full customer records in audit metadata.

## Tests Required

For RBAC-sensitive changes, include:

- allowed role positive test
- disallowed role negative test
- direct API access negative test
- inactive/resigned negative test when relevant
- customer data non-exposure assertion where relevant
- push payload/log privacy assertion for notification work
