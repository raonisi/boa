# Customer Create Assignment Policy

## Purpose

BOA CRM separates direct customer creation from DB assignment.
All active users can create their own personal customers, while assigning DB to other users remains governed by the existing role-based assignment flows.

## Direct Customer Creation

| Role | Can create customer | Assignment policy |
| --- | --- | --- |
| branch_admin | Yes | Can select an active assignee, or default to self |
| sub_branch_admin | Yes | Always assigned to self |
| team_leader | Yes | Always assigned to self |
| member | Yes | Always assigned to self |
| inactive / resigned | No | Server blocks access |

Non-admin roles cannot submit another user's `agentId` during direct customer creation. The server rejects such requests even if a client sends them manually.

## Bulk Customer Import

CSV bulk import reuses the existing import batch flow.

| Role | Can bulk import | Assignment policy |
| --- | --- | --- |
| branch_admin | Yes | Can use CSV assignment columns or force one selected active assignee |
| sub_branch_admin | Yes | All imported customers are assigned to self |
| team_leader | Yes | All imported customers are assigned to self |
| member | Yes | All imported customers are assigned to self |
| inactive / resigned | No | Server blocks access |

For non-admin imports, assignment columns in the CSV do not grant DB distribution rights. Imported rows are assigned to the importing user by server policy.

## DB Assignment And Scope

- `scope=all` remains available only to `branch_admin`.
- `scope=mine` for `branch_admin` returns customers assigned to the branch admin.
- Non-admin users continue to see only their allowed range:
  - `sub_branch_admin`: subordinate customers
  - `team_leader`: own team customers
  - `member`: own assigned customers
- Existing DB assignment, reassignment, assignment history, import batch, and batch cancellation policies remain unchanged.

## Operational Safety

- Do not test with real customer data.
- Do not commit `.env` or secret values.
- Do not reset, drop, or hard delete production DB data.
- Activity logs must be preserved.
- Direct customer creation logs must not contain sensitive customer details beyond minimal audit metadata.
