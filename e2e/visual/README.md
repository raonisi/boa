# BOA CRM Mock Visual Baselines

This visual suite captures mock-data screenshots for the core BOA CRM work
surfaces. It must not be pointed at production, Railway, or a real browser
session with real customer data.

## Commands

- Compare existing baselines:
  `pnpm.cmd test:e2e:visual`
- Update baselines intentionally:
  `pnpm.cmd test:e2e:visual:update`
- Desktop-only compare:
  `pnpm.cmd test:e2e:visual:desktop`
- Mobile-only compare:
  `pnpm.cmd test:e2e:visual:mobile`

The update command is separate on purpose. Do not use snapshot updates to hide
layout regressions.

## Covered Screens

- Dashboard: `/`
- Customer list: `/customers`
- Customer detail: `/customers/101`
- DB assignment: `/customers/assign`
- Bulk import: `/customers/bulk-import`
- Calendar: `/calendar`
- Notifications: `/notifications`
- Downloads: `/download`
- Operation risk: `/operation-risk`

Each screen has a desktop `1440x900` full-page baseline and mobile `390x844` /
`360x800` viewport baselines. Mobile viewport capture is intentional: it keeps
the baseline aligned with the first-screen design QA target and avoids storing
unnecessary below-fold operational mock rows.

## Privacy Rules

- The suite uses `mockBoaTrpc`; it does not use production URL, production DB,
  or real customer accounts.
- Screenshot masks cover mock names, test users, phone links, birth dates, and
  E2E email-like strings.
- Trace, video, and automatic failure screenshots are disabled for this visual
  spec to avoid storing unmasked transient artifacts.
- Never commit screenshots collected from `https://raonisis.kr` or another live
  operational session.

## Layout Rules

- Page-level horizontal overflow above the existing BOA E2E tolerance of 8px is
  rejected.
- Internal horizontal scrolling is allowed only for documented bounded
  containers such as table/filter rows, Radix scroll areas, notification bulk
  actions, or the Operation Risk tab strip.
- Customer detail mobile baselines also check that the action bar stays above
  `MobileNav` and that the CTA center is clickable.
