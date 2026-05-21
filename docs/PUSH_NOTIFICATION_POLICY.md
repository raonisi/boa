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
- Customer birthday reminder
  - Title: `BOA 고객관리 알림`
  - Body: `오늘 확인할 고객 기념일이 있습니다.`
  - Basis: `customers.birthDate` month/day in `Asia/Seoul`
- Contract 90-day reminder
  - Title: `BOA 계약관리 알림`
  - Body: `점검할 계약 관리 일정이 있습니다.`
  - Basis: `contracts.contractDate + 90 days` in `Asia/Seoul`
- Contract 365-day reminder
  - Title: `BOA 계약관리 알림`
  - Body: `갱신 또는 점검할 계약 관리 일정이 있습니다.`
  - Basis: `contracts.contractDate + 365 days` in `Asia/Seoul`
- Long-unmanaged customer reminder
  - Title: `BOA 고객관리 알림`
  - Body: `장기 미관리 고객을 확인해 주세요.`
  - Basis: existing long-unmanaged 90-day customer management rule and consultation history
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
- `business:customer_birthday:customer:{customerId}:{date}:user:{userId}`
- `business:contract_90:contract:{contractId}:{date}:user:{userId}`
- `business:contract_180:contract:{contractId}:{date}:user:{userId}`
- `business:contract_365:contract:{contractId}:{date}:user:{userId}`
- `business:long_unmanaged_90:customer:{customerId}:{date}:user:{userId}`

The log stores type, source, user, status, error code, and sent time. It does not store customer details or token plaintext.

## Schedule Push Engine

`schedule_30min` is deprecated. The schedule push engine now calculates candidates from:

- `schedules.reminderOffsetMinutes`
- `schedules.startTime`
- computed reminder `dueAt = startTime - reminderOffsetMinutes`
- `schedules.endTime` for incomplete schedule reminders

Deleted, inactive, cancelled, completed, no-show, and already completed schedules are excluded. Reminder offset `-1` means no schedule reminder push. Schedule incomplete pushes are deduped separately from reminder pushes.

The engine is implemented as a reusable server function so both admin-triggered runs and scheduler-triggered runs use the same candidate calculation and delivery safeguards.

## Customer and Contract Business Push Engine

The customer/contract business push engine adds Android FCM delivery for:

- `customer_birthday`
- `contract_90`
- `contract_180`
- `contract_365`
- `long_unmanaged_90`

The engine sends only to the assigned owner:

- `customers.agentId` for birthday and long-unmanaged customer reminders
- `contracts.agentId` for contract 90-day, 180-day, and 365-day reminders

Customers and contracts with no owner, inactive rows, or deleted rows are skipped. Inactive and resigned users are excluded before delivery. Business reminders reuse the existing `followUpTodayEnabled` work-notification preference to avoid a schema migration. Quiet hours, active Android token lookup, dedupe keys, invalid-token handling, and `push_notification_logs` are reused through `sendPushToUsers`.

Business reminder candidate dates are calculated in `Asia/Seoul`. Birthday matching uses month/day so a stored birth year does not cause annual reminders to be missed. Contract milestones use `contracts.contractDate`. Long-unmanaged reminders reuse the existing 90-day customer management rule: latest active consultation date when present, otherwise the assignment/creation baseline.

## Invalid Token Handling

When Firebase reports an invalid or unregistered token, the token is marked inactive and revoked so future sends exclude it.

## PR19-4 Follow-Up

Future work:

- Delivery retry policy
- Push notification management UI

## Safety

Do not use real customer data for push tests. Use only `[TEST]` data or mocked tests.
