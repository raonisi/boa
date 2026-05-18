# BOA CRM Time Policy

## Default Time Zone

BOA CRM business time is based on `Asia/Seoul`.

User-selected business dates and times must preserve the wall-clock value the user entered. System audit timestamps may remain instants.

## Time Data Types

- Local Date: date-only business values such as `2026-05-22`.
- Local DateTime: user-selected business date and time such as `2026-05-22T12:00:00`. Do not append `Z`.
- Instant: system timestamps such as `createdAt`, `updatedAt`, activity log timestamps, push `sentAt`, and token timestamps.

## Calendar

Calendar `startTime` and `endTime` are Local DateTime values in `Asia/Seoul`.

Frontend payloads must use local datetime strings from `datetime-local` inputs. Do not use `toISOString()` for schedule form values.

Server create/update paths parse schedule Local DateTime through the shared time policy utility before saving and before calculating reminder due times.

## Follow-up

Follow-up `nextContactDate` is a business Local DateTime. Creating, postponing, listing today, and listing overdue follow-ups use `Asia/Seoul` day boundaries.

Date-only request values are interpreted as the start of that KST business date.

## Push Notifications

Schedule 30-minute push selection compares the current instant with the schedule's KST-preserved instant. A `2026-05-22T12:00:00` schedule is eligible at `2026-05-22T11:30:00` KST, not 20:30 or 21:00.

The schedule push dedupe key remains `schedule:{scheduleId}:30min`, so changing time parsing policy does not create a new duplicate key shape.

## Quiet Hours

Quiet hours are evaluated using the user's preference timezone. The default timezone is `Asia/Seoul`.

Default quiet hours are `21:00` through `08:00`. The start minute is included and the end minute is excluded.

## Android WebView

Android/Capacitor WebView rendering must not rely on the device timezone for business schedule or follow-up display. Use the shared KST formatting helpers for business Local DateTime display and form initialization.

## Allowed `toISOString()` Use

Allowed:

- Instant/system timestamps.
- Log/event metadata.
- Query parameters that explicitly represent an instant.

Forbidden:

- Calendar form payloads.
- Follow-up form payloads.
- Any user-selected business Local DateTime value.

## Regression Criteria

- Calendar create/update/read preserves `2026-05-22T12:00:00`.
- Calendar title or memo-only edits preserve existing start/end time.
- Date-only and time-only UI edits preserve the unchanged component in the submitted Local DateTime.
- Follow-up create/postpone preserves the selected KST date and time.
- Dashboard today/overdue follow-ups use KST day boundaries.
- Schedule 30-minute push targets are selected at the KST wall-clock reminder time.
- Quiet hours skip 21:00 through 07:59 KST and allow from 08:00.
- System timestamps remain instant-based.
