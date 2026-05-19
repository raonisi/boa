# Push Notification Policy

## Purpose

PR19-3 adds safe Firebase Cloud Messaging push notification sending for the BOA internal Android APK. This policy covers work notifications only. It does not add marketing push, mass broadcast push, or customer-specific lock-screen content.

## Notification Types

Implemented safe notification types:

- Today follow-up reminder
  - Title: `BOA 업무 알림`
  - Body: `오늘 확인할 후속관리가 있습니다.`
- Schedule reminder
  - Title: `BOA 일정 알림`
  - Body: `예정된 일정이 있습니다.`
  - Basis: `schedules.reminderOffsetMinutes` and `startTime`
- Schedule incomplete reminder
  - Title: `BOA 일정 알림`
  - Body: `아직 완료되지 않은 일정이 있습니다.`
  - Basis: schedule `endTime`
- Contract delete request
  - Title: `BOA 처리 요청`
  - Body: `처리할 계약 삭제 요청이 있습니다.`
- Branch-admin test push
  - Title: `BOA 테스트 알림`
  - Body: `푸시 알림 수신 준비가 완료되었습니다.`

## Prohibited Payload Content

Push notification title/body must not contain:

- Customer name
- Phone number
- Disease or detailed medical history
- Insurance product name
- Premium amount
- Consultation detail
- Resident registration number
- Policy/certificate number
- Account number

Push payloads in this PR use fixed safe strings.

FCM data payloads must also avoid customer names, phone numbers, birthdates, illness details, product names, premium amounts, tokens, credentials, and consultation details. App users must open the authenticated app notification center or related screen to view authorized details.

## Firebase Admin Credentials

Firebase Admin credentials must be provided through Railway environment variables only.

Supported options:

- `FIREBASE_SERVICE_ACCOUNT_BASE64`
- or all of:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

Do not commit Firebase Admin private keys, service account JSON files, `.env` files, or secrets.

If Firebase environment variables are missing, the server skips push sending and logs a warning. The server must not crash.

## Token Handling

Device tokens come from `user_device_tokens`.

Send targets must satisfy:

- User account status is active
- Token row is active
- `platform = android`
- `revokedAt IS NULL`

Token plaintext must not be written to `activity_logs` or `push_notification_logs`.

## Duplicate Prevention

`push_notification_logs` stores a `dedupeKey` for each push event/user pair.

Examples:

- `delete_request:{id}:created:user:{userId}`
- `follow_up:{id}:{date}:today:user:{userId}`
- `schedule:{id}:reminder:{offset}:{dueAt}:user:{userId}`
- `schedule:{id}:incomplete:{endTime}:user:{userId}`

The log stores type, source, user, status, error code, and sent time. It does not store customer details or token plaintext.

## Schedule Push Engine

`schedule_30min` is deprecated. The schedule push engine now calculates candidates from:

- `schedules.reminderOffsetMinutes`
- `schedules.startTime`
- computed reminder `dueAt = startTime - reminderOffsetMinutes`
- `schedules.endTime` for incomplete schedule reminders

Deleted, inactive, cancelled, completed, no-show, and already completed schedules are excluded. Reminder offset `-1` means no schedule reminder push. Schedule incomplete pushes are deduped separately from reminder pushes.

The engine is implemented as a reusable server function so both admin-triggered runs and scheduler-triggered runs use the same candidate calculation and delivery safeguards.

## Invalid Token Handling

When Firebase reports an invalid or unregistered token, the token is marked inactive and revoked so future sends exclude it.

## PR19-4 Follow-Up

Future work:

- Additional business reminder types such as customer birthdays, contract 90/365 day checks, and long-unmanaged customer reminders
- Delivery retry policy
- Push notification management UI

## Safety

Do not use real customer data for push tests. Use only `[TEST]` data or mocked tests.
