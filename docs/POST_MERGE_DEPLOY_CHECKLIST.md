# BOA CRM Post-Merge Deploy Checklist

## 0) Preconditions
- PR merged into `main`
- Railway project connected to latest `main`
- Required env vars already configured in Railway

## 1) GitHub / Branch Sanity
- Confirm PR is merged and green.
- Confirm merge commit includes:
  - notification priority consistency updates
  - unread-first sorting
  - shared utility refactor
  - tests/docs updates

## 2) Railway Deploy Flow (Expected)
- Build command:
  - `pnpm install && pnpm build`
- Pre-deploy command:
  - `pnpm db:migrate`
- Start command:
  - `pnpm start`

## 3) Deploy Log Checks (Must Pass)
- Build logs:
  - install succeeded
  - build finished without fatal errors
- Pre-deploy logs:
  - migration command succeeded
  - no partial-failure warnings
- Runtime logs:
  - app booted normally
  - no repeated crash/restart loop

## 4) Production Smoke Tests
- Open: `https://raonisis.kr`
- Login and verify:
  - dashboard loads
  - notifications load
  - customer detail page loads
- Priority UX smoke:
  - urgent/today/general filters work
  - unread-first ordering works in queue/list
  - read/process actions update immediately

## 5) Role-based Smoke Tests
- `branch_admin`: full visibility in allowed scope
- `sub_branch_admin`: subordinate-only scope
- `team_leader`: team-only scope
- `member`: own-scope only
- Ensure no cross-scope data exposure by direct navigation

## 6) Mobile Smoke Tests
- Open app home tab:
  - immediate notification section visible
  - priority pills filter correctly
- Open mobile notifications tab:
  - priority ordering and unread-first behavior correct
  - mark-read works and reflects after refresh

## 7) Incident Fallback
- If critical issue found:
  1. Stop further rollout announcements.
  2. Revert the merged PR commit on `main`.
  3. Trigger redeploy.
  4. Re-run smoke tests.

## 8) Release Note Template
- What changed:
  - unified field-priority notification workflow across web/mobile
  - unread-first sorting within priority buckets
  - improved quick-action accessibility and consistency
- Risk level:
  - Low (UI/UX + utility refactor, no schema migration)
- Validation:
  - `pnpm check`, `pnpm test`, `pnpm build` passed

