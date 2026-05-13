# BOA CRM Organization Hierarchy Policy

## Purpose

BOA CRM uses a flexible branch organization tree to decide subordinate visibility and customer assignment boundaries. This policy separates organization hierarchy management from customer self-creation and Excel import, which are handled by the customer creation policy.

## Supported Structure

- `branch_admin` has no parent and can view/manage the whole branch.
- `sub_branch_admin` can be placed under a `branch_admin`.
- `team_leader` can be placed under a `branch_admin` or a `sub_branch_admin`.
- `member` can be placed under a `branch_admin`, `sub_branch_admin`, or `team_leader`.
- `inactive` and `resigned` users are excluded from new organization assignment targets.

This supports:

- Branch-admin direct team leaders.
- Branch-admin direct members.
- Sub-branch-admin direct members.
- Sub-branch-admin team leaders.
- Team-leader members.

## Data Model

`users.parentUserId` is the primary hierarchy field.

Backward compatibility is maintained with existing organization fields:

- `teamId`
- `subBranchAdminId`
- team manager relationships

When `parentUserId` is not set, the server derives a legacy effective parent from existing team and sub-branch fields where possible.

## Subordinate Scope

- `branch_admin`: all active users and all CRM data.
- `sub_branch_admin`: self, direct members, subordinate team leaders, and those leaders' members.
- `team_leader`: self and direct member descendants.
- `member`: own assigned data only.
- `inactive` / `resigned`: protected APIs are blocked.

## Customer Assignment Scope

- `branch_admin`: can assign customers to any active user.
- `sub_branch_admin`: can assign customers only to subordinate `team_leader` and `member` users.
- `team_leader`: can assign customers only to subordinate `member` users.
- `member`: cannot assign customers to another user.

Customer direct creation is separate: active users may create their own customers according to `CUSTOMER_CREATE_ASSIGNMENT_POLICY.md`, but that does not grant DB distribution rights.

## Parent Assignment Rules

- `sub_branch_admin` parent: `branch_admin` only.
- `team_leader` parent: `branch_admin` or `sub_branch_admin`.
- `member` parent: `branch_admin`, `sub_branch_admin`, or `team_leader`.
- `branch_admin` parent: none.

The server blocks:

- self-parent assignments,
- inactive/resigned parent or target users,
- role-incompatible parents,
- cycle creation.

## Activity Log

Organization parent changes are recorded as `USER_ORG_PARENT_CHANGED`.

Logs must not include secrets, customer contact originals, customer memo bodies, or real customer data beyond IDs needed for audit.

## UI Policy

Desktop organization management uses a card tree:

- branch manager,
- direct team leaders,
- direct members,
- sub-branch managers,
- sub-branch direct members,
- subordinate team leaders,
- team members,
- unassigned users.

Mobile organization management uses compact cards and drill-down style editing. Organization parent changes are visible only to `branch_admin`; subordinate users may only view their allowed scope.

## Operational Safety

- No production DB reset/drop/hard delete.
- No real customer data in tests.
- No `.env` commits.
- No activity log deletion.
- Server authorization is required; frontend hiding is only an additional safeguard.
