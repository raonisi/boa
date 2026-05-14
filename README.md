# Insurance CRM

Insurance CRM is an internal CRM for an insurance sales organization. It manages customer DB assignment, consultations, contracts, performance, schedules, notifications, users, teams, downloads, settings, and bulk customer import.

## Mobile app (Flutter / Android)

Internal CRM app sources live under **`apps/boa`**. See [`apps/boa/README.md`](apps/boa/README.md) for Flutter SDK setup and the one-time `flutter create . --platforms=android` step to generate the `android/` folder.


Copy `.env.example` to `.env` and fill in real values. Do not commit `.env` or any real secrets.

## Required Environment Variables

Current production authentication uses Google OAuth 2.0 directly. Railway should be configured with the variables below; legacy Manus/WebDev OAuth variables are not required for production.

- `DATABASE_URL`: MySQL connection string used by Drizzle and the server
- `JWT_SECRET`: session/cookie signing secret
- `GOOGLE_CLIENT_ID`: Google OAuth 2.0 Web application client id used by the server
- `GOOGLE_CLIENT_SECRET`: Google OAuth 2.0 Web application client secret, server-side only
- `GOOGLE_REDIRECT_URI`: Google OAuth callback URI, for example `http://127.0.0.1:3000/api/oauth/callback`
- `VITE_GOOGLE_CLIENT_ID`: public Google OAuth client id used by the browser to build the authorize URL
- `OWNER_GOOGLE_EMAIL`: initial owner Google email for bootstrap/reference only
- `OWNER_OPEN_ID`: optional initial owner open id / Google `sub` for bootstrap/reference
- `BUILT_IN_FORGE_API_URL`: built-in Forge API URL
- `BUILT_IN_FORGE_API_KEY`: built-in Forge API key

Only public browser-safe values should use the `VITE_` prefix. Do not move `DATABASE_URL`, `JWT_SECRET`, API keys, database passwords, or service-role keys into `VITE_` variables.

### Google OAuth 2.0 Setup

This CRM uses Google OAuth 2.0 Web Server Flow directly.

Local development:

- Authorized JavaScript origin: `http://127.0.0.1:3000`
- Authorized redirect URI: `http://127.0.0.1:3000/api/oauth/callback`

Production:

- Authorized JavaScript origin: `https://your-crm-domain.example`
- Authorized redirect URI: `https://your-crm-domain.example/api/oauth/callback`

The redirect URI must exactly match the value registered in Google Cloud Console. Production must use HTTPS. Keep `GOOGLE_CLIENT_SECRET` only in server environment variables. Never commit `.env`.

### Railway Environment Variables

Set the Google OAuth variables listed above in Railway. Do not add legacy Manus/WebDev OAuth portal variables for the current production deployment; the browser login button uses `VITE_GOOGLE_CLIENT_ID` and the Google authorize endpoint directly.

### Railway Deploy Commands

Use committed Drizzle migrations for production deploys. Do not run migration generation during Railway deploy.

- Build Command: `pnpm install && pnpm build`
- Pre-Deploy Command: `pnpm db:migrate`
- Start Command: `pnpm start`

`pnpm db:migrate` runs only `drizzle-kit migrate`, applying migration SQL files that are already committed in the repository. `pnpm db:push` is a development helper that runs `drizzle-kit generate && drizzle-kit migrate`; do not use `pnpm db:push` in Railway Pre-Deploy because it can generate new migration files during deployment.

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

For production/Railway:

```bash
pnpm db:migrate
```

For local development when intentionally generating a new migration:

```bash
pnpm db:push
```

### Migration Precautions

- Migration SQL files must be committed in the PR before deployment.
- Railway Pre-Deploy must use `pnpm db:migrate`, not `pnpm db:push`.
- Railway must not run `drizzle-kit generate` during production deploy.
- If migration fails, stop the deploy and inspect the failure before retrying.
- Clean or reset staging/test databases can apply the full migration set from scratch.
- If `assignment_history` columns were manually added to an existing database, inspect the current column state before applying migrations to avoid duplicate-column errors.
- Never reset a production database as part of migration recovery.
- Never run DROP, reset, or hard delete as part of normal production migration.
- Validate migrations on staging/test before applying them to production.
- Back up production data before any production migration.

### Migration State Checks

Use read-only checks before and after production migration. Do not print secret environment variable values or customer data.

- Check applied Drizzle migrations: query `__drizzle_migrations` ordered by `id`.
- Check PR2 import columns on `customers`: `importBatchId`, `importedBy`, `importedAt`.
- Check PR2 import batch table: `import_batches`.
- Check PR1 delete request table: `delete_requests`.
- Check PR4 follow-up table: `follow_ups`.

## Permission Summary

- `branch_admin`: top-level administrator. Can manage all customers, assignments, users, teams, downloads, settings, logs, and imports.
- `sub_branch_admin`: can access only assigned DB and subordinate organization data.
- `team_leader`: can access only their team data.
- `member`: can access only their own assigned data.
- `inactive` / `resigned`: blocked from protected APIs and login flow.

## Data Safety

Use only test data during development. Do not upload real customer data, resident registration numbers, policy numbers, ID images, medical details, account numbers, card numbers, API keys, database passwords, or service role keys.
