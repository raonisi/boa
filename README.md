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
- `VITE_APP_ID`: Manus app id
- `OAUTH_SERVER_URL`: OAuth server URL
- `OWNER_OPEN_ID`: initial owner open id that becomes `branch_admin`
- `BUILT_IN_FORGE_API_URL`: built-in Forge API URL
- `BUILT_IN_FORGE_API_KEY`: built-in Forge API key

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

## Permission Summary

- `branch_admin`: top-level administrator. Can manage all customers, assignments, users, teams, downloads, settings, logs, and imports.
- `sub_branch_admin`: can access only assigned DB and subordinate organization data.
- `team_leader`: can access only their team data.
- `member`: can access only their own assigned data.
- `inactive` / `resigned`: blocked from protected APIs and login flow.

## Data Safety

Use only test data during development. Do not upload real customer data, resident registration numbers, policy numbers, ID images, medical details, account numbers, card numbers, API keys, database passwords, or service role keys.
