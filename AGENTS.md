# AGENTS.md — BOA Insurance CRM Repository Rules

## Project identity
This repository is `raonis/boa` or `raonisi/boa`. Before editing, confirm the actual repository name and branch.
This project is an internal insurance sales CRM for a Korean insurance team.

## Non-negotiable workflow
- Do not rebuild the project from scratch.
- Preserve the existing architecture, routes, database schema style, auth flow, and UI conventions.
- Before code changes, analyze current implementation and produce a plan.
- Make small, reviewable changes.
- Run available checks after edits: `pnpm test`, `pnpm build`, or the closest available script.
- Never commit secrets, `.env`, real customer data, API keys, database passwords, service role keys, or production CSVs.

## Core roles
- `branch_admin`: branch manager, final administrator, full access.
- `sub_branch_admin`: deputy manager, only assigned DB and subordinate organization.
- `team_leader`: team leader, own team only.
- `member`: team member, own data only.
- `inactive` / `resigned`: blocked from login and protected API access.

## Critical safety rules
- No Korean resident registration number fields.
- No policy/certificate number field.
- No ID-card upload.
- No detailed illness history field.
- No plaintext password storage.
- No hard delete for customers, contracts, consultations, schedules, or logs.
- Server-side authorization is required; front-end hiding alone is not enough.
- Direct URL/API access outside role scope must return `FORBIDDEN` or `BAD_REQUEST`.

## Development focus
When asked to implement or audit the CRM, use the repository skill:
`$boa-crm-full-build`
