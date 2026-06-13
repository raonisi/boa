# PR Title

feat(ui): unify field-priority notification workflow

## Summary

- Align urgent/today/general notification priority behavior across:
  - web dashboard queue
  - web notification center
  - mobile home immediate notifications
  - mobile notification tab
- Apply unread-first ordering inside each priority bucket.
- Add consistent quick filter interactions and badges for faster field response.
- Refactor duplicated priority/sort logic into shared utilities (web/mobile).
- Add regression tests and a field UAT checklist document.

## Included Changes

- Web
  - `client/src/pages/Dashboard.tsx`
  - `client/src/pages/Notifications.tsx`
  - `client/src/pages/CustomerDetail.tsx`
  - `client/src/lib/notificationPriority.ts`
- Mobile (Flutter)
  - `apps/boa/lib/features/home/home_tab.dart`
  - `apps/boa/lib/features/notifications/notifications_tab.dart`
  - `apps/boa/lib/features/notifications/notification_priority.dart`
- Tests/Docs
  - `server/notification-priority-ui-utils.test.ts`
  - `docs/UX_FIELD_UAT_CHECKLIST.md`

## Test Plan

- [x] `pnpm check`
- [x] `pnpm test` (245 passed)
- [x] `pnpm build`
- [ ] Manual UAT by role using `docs/UX_FIELD_UAT_CHECKLIST.md`

## Risk / Rollback

- Risk: Low (UI/UX and shared utility refactor, no schema migration).
- Rollback: revert commit `dbfd806` on branch `feature/field-ux-priority-consistency`.

## Notes

- Existing build warnings about analytics placeholders and large chunks are unchanged and non-blocking for this PR.
