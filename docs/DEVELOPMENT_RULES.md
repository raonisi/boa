# BOA CRM Development Rules

**Master standard (Cursor + team):** [`BOA_CRM_FINANCIAL_SAAS_DEVELOPMENT_STANDARD.md`](./BOA_CRM_FINANCIAL_SAAS_DEVELOPMENT_STANDARD.md) — governance, RBAC, secrets, DB, migrations, Railway, Git, push, Android, reporting, and completion criteria. The Cursor rule `.cursor/rules/boa-financial-saas-standard.mdc` enforces the same for the agent.

- **Security First**: Never log or output PII (Customer Name, Phone, Disease, Insurance Info).
- **Environment**: Never commit `.env`, `google-services.json`, or Firebase Admin keys.
- **Git Flow**: Work on branches → PR → Merge to main. No direct push to main unless an explicit documented exception.
- **Push Policy**: Never include customer PII in Push Notification title/body.
- **Database**: Use Drizzle ORM. Run `pnpm db:migrate` for schema changes. No hard deletes on `activity_logs`.
- **Tech stack**: Confirm versions in `package.json` (React, Vite, Tailwind, tRPC, Capacitor); do not rely on stale shorthand.
