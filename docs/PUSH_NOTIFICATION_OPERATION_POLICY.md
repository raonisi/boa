# Push Notification Operation Policy

## Purpose

PR19-4 adds user push preferences, quiet-hours filtering, and a branch-admin-only push operation dashboard for the internal Android APK.

This PR does not add marketing notifications or customer-specific lock-screen content. Push title/body text must stay privacy-safe.

## User Preferences

Each active user has one `push_notification_preferences` row.

Default values:

- `followUpTodayEnabled`: true
- `scheduleReminderEnabled`: true
- `deleteRequestEnabled`: true
- `testNotificationEnabled`: true
- `quietHoursEnabled`: true
- `quietHoursStart`: `21:00`
- `quietHoursEnd`: `08:00`
- `timezone`: `Asia/Seoul`

Users can view and update only their own preferences. Branch admins do not edit another user's preferences in PR19-4.

Inactive and resigned users are excluded from token lookup and push delivery.

## Quiet Hours

When quiet hours are enabled, push delivery is skipped if the user's local time is inside the configured range.

Default quiet hours are 21:00 through 08:00 Asia/Seoul.

Quiet-hours skips are recorded as `skipped_quiet_hours` in `push_notification_logs`.

No urgent bypass policy is introduced in PR19-4. A force option is available only for branch-admin test sends.

## Delivery Filter Order

Before sending, the server applies:

1. Active user and active Android device token lookup
2. Notification type preference check
3. Quiet-hours check
4. Dedupe key check
5. Safe payload validation
6. Firebase sending or missing-config skip

## Schedule Push Automation

The legacy fixed `schedule_30min` sender is deprecated. Schedule app push delivery is now driven by the schedule push reminder engine:

- Reminder candidates use `schedules.reminderOffsetMinutes`, `startTime`, and computed `dueAt`.
- Incomplete candidates use `endTime` for schedules that are still not completed.
- Deleted, inactive, cancelled, completed, no-show, and `completedAt` schedules are excluded.
- The same `scheduleReminderEnabled`, quiet-hours, dedupe, active Android token, and log policies apply.

Available triggers:

- Branch-admin manual operation: `pushNotifications.sendSchedulePushReminderEngine`
- Backward-compatible deprecated wrapper: `pushNotifications.sendSchedule30MinuteReminders`
- Scheduler/internal trigger: `pushNotifications.runSchedulePushReminderEngineInternal`

The scheduler/internal trigger requires Railway or the scheduler caller to provide `PUSH_SCHEDULER_SECRET` and pass the same secret in the mutation input. This allows Railway Cron or another internal scheduler to call the engine without a human branch-admin click. The secret must be stored only in Railway Variables and must not be committed.

Recommended Railway Cron cadence: every 5 minutes. The engine uses a short lookback window and dedupe keys to avoid duplicate sends when the trigger runs repeatedly.

## Log Status Values

`push_notification_logs.status` can contain:

- `sent`
- `failed`
- `skipped_no_token`
- `skipped_disabled`
- `skipped_quiet_hours`
- `skipped_missing_config`
- `duplicate_skipped`
- `invalid_token_deactivated`
- legacy `skipped`

Logs must not store device token plaintext, customer names, phone numbers, insurance details, product names, premiums, or consultation details.

## Operation Dashboard

Only `branch_admin` can access push operation APIs and UI.

The dashboard shows aggregate counts and recent logs:

- today/filtered log count
- success count
- failed count
- skip count
- inactive token count
- notification type
- status
- user name
- source type/id
- error code

Token plaintext and customer information are not displayed.

## Firebase Environment Variables

Firebase Admin credentials are managed only through Railway Variables:

- `FIREBASE_SERVICE_ACCOUNT_BASE64`, or
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Do not commit Firebase Admin JSON, private keys, `.env`, `google-services.json`, APKs, AABs, JKS, or keystores.

If Firebase Admin variables are missing, the server must not crash. Push sends are logged or returned as skipped.

## PR19-5 Candidates

- Retry policy for quiet-hours skips
- User-facing delivery status
- Admin retry action for safe failed sends
- Organization-level notification policy

## Test Data

Use only `[TEST]` fixtures in tests. Do not use real customer data for push testing.
