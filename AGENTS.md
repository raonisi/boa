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

## Cursor Cloud specific instructions

### Services overview

| Service | How to run | Notes |
|---------|-----------|-------|
| Backend + Vite frontend | `pnpm dev` | Single Express server on port 3000 with Vite middleware in dev mode |
| MySQL | Docker: `docker run -d --name mysql-boa -e MYSQL_ROOT_PASSWORD=devpass -e MYSQL_DATABASE=insurance_crm -p 3306:3306 mysql:8.0 --default-authentication-plugin=mysql_native_password` | Required for the app to connect |
| Migrations | `pnpm db:migrate` | Run after MySQL is available; applies committed SQL migration files |

### Key commands (already in package.json)
- `pnpm dev` — starts Express+Vite dev server (port 3000)
- `pnpm check` — TypeScript type check (`tsc --noEmit`); has 2 pre-existing errors in `server/mobileRoutes.ts`
- `pnpm test` — runs vitest unit/integration tests (no DB needed; tests use mocks)
- `pnpm build` — Vite frontend build + esbuild server bundle

### Non-obvious gotchas
- **Docker required for MySQL**: The VM does not have MySQL installed natively. Use Docker (`mysql:8.0`) with fuse-overlayfs storage driver and iptables-legacy. Docker daemon must be started manually: `sudo dockerd &>/tmp/dockerd.log &`
- **Google OAuth placeholder**: Dev `.env` uses placeholder `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. The app will redirect to Google OAuth but fail with `invalid_client`. To test authenticated flows, real Google OAuth credentials must be provided as secrets.
- **DATABASE_URL format**: `mysql://root:devpass@127.0.0.1:3306/insurance_crm` (local Docker MySQL)
- **Tests don't need DB**: All 245 tests use in-memory mocks (vi.mock) and run without DATABASE_URL.
- **esbuild native binary**: After `pnpm install --frozen-lockfile`, run `pnpm rebuild esbuild` if the esbuild binary is missing (the pnpm lockfile may skip postinstall scripts).
- **Health check**: `GET /api/health` returns `{"ok":true,"service":"boa-crm"}` — use this to confirm the server is running.
