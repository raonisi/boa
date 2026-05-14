# BOA CRM Development Rules

- **Security First**: Never log or output PII (Customer Name, Phone, Disease, Insurance Info).
- **Environment**: Never commit `.env`, `google-services.json`, or Firebase Admin keys.
- **Git Flow**: Work on branches → PR → Merge to main. No direct push to main.
- **Push Policy**: Never include customer PII in Push Notification title/body.
- **Database**: Use Drizzle ORM. Run `pnpm db:migrate` for schema changes. No hard deletes on `activity_logs`.
- **Tech Stack**: React 19, Vite 7, Tailwind 4, tRPC, Capacitor.
