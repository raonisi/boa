# Insurance CRM

Insurance CRM is an internal CRM for an insurance sales organization. It manages customer DB assignment, consultations, contracts, performance, schedules, notifications, users, teams, downloads, settings, and bulk customer import.

## Setup

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill in real values. Do not commit `.env` or any real secrets.

## Required Environment Variables

- `DATABASE_URL`: MySQL connection string used by Drizzle and the server
- `JWT_SECRET`: session/cookie signing secret
- `VITE_APP_ID`: Manus app id exposed to the browser for OAuth login
- `VITE_OAUTH_PORTAL_URL`: public OAuth portal URL used by the browser login redirect
- `OAUTH_SERVER_URL`: OAuth server URL used by the server
- `OWNER_OPEN_ID`: initial owner open id that becomes `branch_admin`
- `BUILT_IN_FORGE_API_URL`: built-in Forge API URL
- `BUILT_IN_FORGE_API_KEY`: built-in Forge API key

Only public browser-safe values should use the `VITE_` prefix. Do not move `DATABASE_URL`, `JWT_SECRET`, API keys, database passwords, or service-role keys into `VITE_` variables.

## Development

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Test

```bash
pnpm test
```

## Database

```bash
pnpm db:push
```

### Migration Precautions

- Clean or reset staging/test databases can apply the full migration set from scratch.
- If `assignment_history` columns were manually added to an existing database, inspect the current column state before applying migrations to avoid duplicate-column errors.
- Never reset a production database as part of migration recovery.
- Validate migrations on staging/test before applying them to production.
- Back up production data before any production migration.

## Permission Summary

- `branch_admin`: top-level administrator. Can manage all customers, assignments, users, teams, downloads, settings, logs, and imports.
- `sub_branch_admin`: can access only assigned DB and subordinate organization data.
- `team_leader`: can access only their team data.
- `member`: can access only their own assigned data.
- `inactive` / `resigned`: blocked from protected APIs and login flow.

## Data Safety

Use only test data during development. Do not upload real customer data, resident registration numbers, policy numbers, ID images, medical details, account numbers, card numbers, API keys, database passwords, or service role keys.
