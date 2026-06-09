# BOA CRM Mobile App Architecture

This document is the source of truth for mobile app roles, pilot scope, security boundaries, and the next development roadmap. It applies after Antigravity review verdict **FLUTTER_FIELD_APP_READY**.

## A. Official Mobile App Standard

| Item | Value |
| --- | --- |
| **Pilot official mobile app** | Flutter |
| **Path** | `apps/boa` |
| **App type** | Native + WebView hybrid |
| **Purpose** | Field sales workflows on mobile (현장 영업 기능 중심) |
| **Package ID** | `kr.raonisis.boa` (same as legacy Capacitor shell and Firebase policy) |

**Stack (Flutter field app)**

- Entry: `apps/boa/lib/main.dart`
- Navigation: GoRouter
- State: Riverpod
- API: Dio (`/api/mobile/*` JSON routes)
- Auth: `google_sign_in` + secure session via `flutter_secure_storage`
- Push: `firebase_core` / `firebase_messaging` + device token registration

**Related docs**

- **Native 80% coverage matrix:** [FLUTTER_NATIVE_FIELD_COVERAGE.md](./FLUTTER_NATIVE_FIELD_COVERAGE.md) — field vs WebView/PC scope, PR roadmap, decision criteria
- Flutter setup and build: [FLUTTER_ANDROID_APP.md](./FLUTTER_ANDROID_APP.md), [apps/boa/README.md](../apps/boa/README.md)
- Legacy Capacitor APK shell: [ANDROID_INTERNAL_APK_SETUP.md](./ANDROID_INTERNAL_APK_SETUP.md)
- Pilot verification gate: [PILOT_READINESS_RECHECKLIST.md](./PILOT_READINESS_RECHECKLIST.md)
- **Flutter APK pilot deployment:** [FLUTTER_APK_PILOT_DEPLOYMENT_CHECKLIST.md](./FLUTTER_APK_PILOT_DEPLOYMENT_CHECKLIST.md) — build, install, smoke, security file controls before limited pilot rollout

## B. Flutter Native Responsibilities

These workflows are implemented or targeted as **Flutter native screens** for the pilot field app:

| Area | Scope |
| --- | --- |
| Authentication | Google sign-in, session bootstrap |
| Home | Dashboard, today overview |
| Today work | 오늘 할 일 |
| Customers | List, search, detail |
| Consultations | 상담기록 |
| Customer ops | Priority, tags, next action |
| Follow-ups | Create, complete, defer (후속관리) |
| Calendar | Schedule create, complete (일정) |
| Contracts | Contract list + **native create** (계약 목록·신규 등록) |
| Notifications | Inbox (알림함) |
| Push settings | User-facing notification preferences (Flutter `PushPreferencesScreen`, PR19-4) |
| Performance | Goals and performance summary (성과/목표 현황) |

Native implementation should prefer existing mobile REST endpoints and RBAC rules on the server. Do not weaken scope checks in the client.

**Pilot UX polish (Flutter only):** shared loading skeletons, empty/error states (`apps/boa/lib/core/widgets/boa_async_states.dart`), async `context.mounted` safety, WebView admin entry labels, and polished `CrmWebScreen` loading/error/back/PC-guidance UX. No server/API changes.

## C. WebView Retained Areas

Complex admin and multi-step web CRM flows stay in **embedded WebView** (`apps/boa/lib/features/web/`) or the web app until a dedicated native migration is approved:

| Area | Reason to keep WebView |
| --- | --- |
| Sales pipeline | 세일즈 파이프라인 — dense kanban / multi-filter UI |
| Sales analytics | 영업 분석 — charts and report tables |
| Bulk customer import | 고객 일괄 등록 — file upload and validation |
| DB assignment | DB 배정 — branch-admin workflow |
| Organization management | 조직 관리 |
| User / team management | 사용자·팀 관리 |
| Admin activity logs | 관리자 활동 로그 |
| Handoff | 인수인계 |
| Duplicate customer merge | 중복고객 병합 |
| Deleted data management | 삭제 데이터 관리 |
| Other complex admin tools | RBAC-heavy, low field-use frequency |

WebView routes must respect the same session and RBAC as the main web CRM. Direct URL access outside role scope must remain blocked server-side.

## D. Capacitor Legacy Status

The repository still contains the **Capacitor-based Android shell**. It is **not removed** in the pilot officialization PR.

| Item | Status |
| --- | --- |
| `capacitor.config.ts` | **Keep** — legacy/fallback reference |
| Root `android/app` | **Keep** — legacy Capacitor project |
| App ID | `kr.raonisis.boa` |
| App name | BOA 지점관리 CRM |
| Web dir | `dist/public` |
| Server URL | `https://raonisis.kr` |

**Policy**

- Do **not** delete Capacitor or root `android/app` until Flutter pilot stability is proven.
- Actual deprecation is a **separate PR** after pilot rollout and operator sign-off.
- Capacitor remains a **legacy/fallback** install path for teams that have not migrated to the Flutter APK.

## E. Security Standards

All mobile work (Flutter and WebView) must follow [AGENTS.md](../AGENTS.md) and [RBAC and Customer Data Safety](../docs/ops/rbac-safety.md).

**Never commit**

- `.env`, `.env.local`, `.env.production`
- `google-services.json`
- Firebase Admin SDK JSON
- APK, AAB, JKS, keystore files
- `local.properties`, `android/local.properties`

**Never hardcode** API keys, DB URLs, OAuth secrets, JWT secrets, or Firebase credentials in source.

**Logging and push payloads**

- Do not log device token plaintext.
- Push title, body, and log metadata must **not** include customer names, phone numbers, illness details, product names, or premiums.
- Mask or omit sensitive fields in non-operational views per existing BOA policy.

**Data handling**

- Use only `[TEST]` data for pilot verification writes (see [PILOT_READINESS_RECHECKLIST.md](./PILOT_READINESS_RECHECKLIST.md)).
- No production DB reset, drop, truncate, or manual hard delete during mobile QA.

## F. PR19-4 Criteria (Notification Preferences)

PR19-4 defines user notification preferences and branch-admin push operations. This architecture doc sets implementation boundaries; schema and delivery rules remain in [PUSH_NOTIFICATION_OPERATION_POLICY.md](./PUSH_NOTIFICATION_OPERATION_POLICY.md).

| Concern | Direction |
| --- | --- |
| User personal notification settings | **Flutter native first** — `PushPreferencesScreen` + `GET/PATCH /api/mobile/push-preferences` |
| Branch-admin push operation dashboard | **Web admin UI** — `/push-notifications` (`PushNotificationOperations`), branch_admin only |
| Quiet hours, ON/OFF toggles | Must stay compatible with server policy (`push_notification_preferences`, quiet-hours filter in `sendPushToUsers`) |
| Device tokens | Keep existing `user_device_tokens` structure and registration flow |
| Delivery audit | Keep existing `push_notification_logs` structure; no token plaintext in logs |

**Compatibility rules**

- Users edit only their own preferences; branch admins do not edit another user's preferences in PR19-4.
- Quiet hours default: 21:00–08:00 `Asia/Seoul` when enabled.
- Notification type toggles (`followUpTodayEnabled`, `scheduleReminderEnabled`, etc.) must match server defaults and filter order documented in push policy.
- No schema migration is required for this officialization PR; PR19-4 implementation must reuse existing tables.

## G. Development Roadmap

Ordered next steps after this document:

1. ~~**Contract registration native migration**~~ — **native create shipped** (`ContractCreateScreen`); contract edit and advanced flows remain WebView until a follow-up PR.
2. ~~**PR19-4 completion**~~ — Flutter user notification settings + Web branch-admin push operations dashboard (shipped).
3. **Flutter pilot deployment checklist** — internal APK distribution, SHA-1/OAuth alignment, FCM smoke, role-based field UAT.
4. **Capacitor legacy decision** — after pilot stabilization, separate PR to deprecate or remove `capacitor.config.ts` and root `android/app` if no longer needed.

## Verification Baseline

### Web monorepo (run from repository root)

```bash
pnpm.cmd check
pnpm.cmd test
pnpm.cmd build
```

Docs-only changes normally require at least `pnpm.cmd check`. Run full test/build when runtime behavior changes.

### Flutter field app (`apps/boa`)

```bash
cd apps/boa
flutter --version
flutter pub get
flutter analyze
flutter test
```

APK/AAB builds are **not** required for documentation-only PRs. Use [apps/boa/tool/build_debug_apk.ps1](../apps/boa/tool/build_debug_apk.ps1) only with explicit approval.

## Change Control

- This PR **documents** Flutter as the official pilot field app; it does not delete Capacitor or refactor Flutter at scale.
- Server, API, DB, RBAC, and migration files are out of scope unless a follow-up task explicitly requests them.
- Stage only intentional paths; never use `git add .`.
