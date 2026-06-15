# Google Calendar Integration Policy (PR22)

## 1. 기능 목적

BOA 지점관리 CRM의 일정, 상담 예정, 후속관리, 회의/교육 일정을 Google Calendar 공유 캘린더에 안전하게 동기화합니다. TimeTree 직접 API 연동이 아니라 Google Calendar를 표준 공유 캘린더 허브로 사용합니다.

**기본값은 안전 제목 모드**입니다. 지점장(`branch_admin`)이 명시적으로 설정을 켜야 Google Calendar에 원문 제목·설명·고객 이름·연락처가 표시될 수 있습니다.

## 2. 3개 캘린더 구조

| calendarType | 표시명 | 대상 |
|---|---|---|
| `branch_common` | BOA 지점 공통 일정 | 회의, 교육, 지점 행사, 공통 공지 |
| `consultation_followup` | BOA 상담·후속관리 일정 | 상담, 후속관리, 재연락, 보장점검, 방문 |
| `admin` | BOA 관리자 일정 | 지점장/팀장/부지점장 운영 회의 |

## 3. 캘린더 분류 수동 선택 (Hotfix)

캘린더 분류는 **자동 분기보다 사용자가 CRM에서 선택한 값이 우선**합니다.

- CRM 일정 등록/수정 시 **공통일정 / 상담일정 / 관리자일정**을 직접 선택할 수 있습니다.
- 저장 컬럼: `schedules.calendarCategory` (`branch_common` | `consultation_followup` | `admin`)
- 일정 유형 변경 시 기본 추천 분류는 자동으로 제안되지만, 사용자가 분류를 바꾸면 그 값이 유지됩니다.
- `member`는 관리자일정 선택이 서버에서 차단됩니다.

### Google Calendar sync 대상

| calendarCategory | Google Calendar |
|---|---|
| `branch_common` | BOA 지점 공통 일정 |
| `consultation_followup` | BOA 상담·후속관리 일정 |
| `admin` | BOA 관리자 일정 |

동기화 우선순위: (1) 저장된 `calendarCategory` → (2) 명시 파라미터 → (3) 일정 유형 추천 → (4) `branch_common` fallback

calendarId가 비활성/미등록이면 `SKIPPED_MISSING_CALENDAR`로 기록하며 다른 캘린더로 대체 sync하지 않습니다.

## 4. 원문 동기화 정책 (branch_admin 전용)

`google_calendar_org_settings` 설정 (모두 기본값 `false`):

| 설정 | 설명 |
|---|---|
| `syncRawTitleToGoogleCalendar` | BOA CRM 입력 제목을 Google Calendar에 그대로 표시 |
| `syncRawDescriptionToGoogleCalendar` | BOA CRM 입력 설명을 Google Calendar에 그대로 표시 |
| `allowCustomerNameInGoogleCalendar` | 제목·설명에 고객 이름 표시 허용 |
| `allowCustomerContactInGoogleCalendar` | 제목·설명에 고객 연락처 표시 허용 |

### 운영 방식

- 설정이 `false`이면 기존 안전 제목/설명 모드를 사용합니다 (`[BOA] 상담 예정 · A-102` 형식).
- 설정이 `true`이면 사용자가 입력한 제목/설명과 고객명/연락처를 **공유 캘린더 포함** Google Calendar에 반영할 수 있습니다.
- `syncRawTitleToGoogleCalendar=true`이면 입력 제목을 그대로 사용합니다 (A-38 익명 치환 없음).
- `allowCustomerNameInGoogleCalendar=true`이면 고객 이름을 A-38로 치환하지 않습니다.
- `allowCustomerContactInGoogleCalendar=true`이면 연락처를 제거하지 않습니다.
- **Google Calendar 공유 대상에게 고객 이름과 연락처가 보일 수 있으므로** 공유 권한을 확인한 뒤 사용합니다.
- `branch_admin`만 전체 정책을 켜고 끌 수 있습니다.

### 캘린더별 적용

- `branch_common`, `consultation_followup`, `admin`, `actor_personal_calendar` 모두 동일 org 정책을 따릅니다.
- 관리자 일정(`admin`)은 고객 일정이 아니므로 고객명/연락처 입력을 유도하지 않습니다.

### 서버 함수

- `buildGoogleCalendarTitle(input, policy)` — 원문/안전 제목 분기
- `buildGoogleCalendarDescription(input, policy)` — 원문/안전 설명 분기
- `assertGoogleCalendarPayloadPolicy(payload, policy)` — secret/token/API Key는 항상 차단; 원문 정책 ON 시 고객명/연락처는 허용
- `sanitizeGoogleCalendarLogMetadata(metadata)` — activity_logs 저장 전 필수 적용

## 4. 연락처 표시 정책 (레거시 · 안전 모드)

원문 동기화 정책이 꺼져 있을 때만 적용됩니다.

### BOA CRM 내부

- 일정 등록자(`createdBy`)는 본인이 등록한 일정의 고객 연락처를 볼 수 있습니다.
- 일정 담당자(`userId` / owner)는 본인 담당 일정의 고객 연락처를 볼 수 있습니다.
- `inactive` / `resigned`는 접근 차단됩니다.

### Google Calendar (안전 모드)

- **제목·위치**: 고객 연락처를 넣지 않습니다.
- **공유 캘린더**: 설명에도 연락처를 넣지 않습니다.
- **개인 캘린더** (`actor_personal_calendar`): `includeCustomerContactForActorCalendar=true` + 개인 calendarId + `contactDisplayConsent=true` + 등록자/담당자일 때만 설명에 연락처 허용.

## 5. activity_logs 정책

Google Calendar에 고객명·연락처·원문 제목/설명을 표시할 수 있어도 **activity_logs에는 저장하지 않습니다**.

### 허용 metadata

- `calendarType`, `syncTargetType`, `boaEventType`, `boaEventId`, `syncStatus`, `targetUserId`
- `rawTitleSynced`, `rawDescriptionSynced`, `customerNameAllowed`, `customerContactAllowed`
- `actorId`, `contactIncluded` (불리언 플래그)

### 금지 metadata

- 고객명 원문, 연락처 원문, 원문 일정 제목/설명
- Google access token, refresh token, API Key, secret
- Google raw API response

## 6. 공유 + 개인 이중 동기화

상담·후속관리 일정은 공유 캘린더 이벤트와 등록자·담당자 개인 캘린더 이벤트를 각각 동기화합니다. 원문 정책이 켜져 있으면 두 대상 모두 동일한 org 정책을 따릅니다.

## 7. 권한별 운영 기준

- `branch_admin`: calendarId 등록, OAuth 연결, **원문 동기화 정책** 변경, 동기화 상태/재시도
- `sub_branch_admin` / `team_leader`: 산하 동기화 상태 조회 (정책 변경 불가)
- `member`: 본인 동기화 상태 조회, **본인 개인 캘린더 설정**만 변경
- `inactive` / `resigned`: 전체 접근 차단

## 8. calendarId 등록 방법

1. 지점장이 Google Calendar OAuth 연결
2. 공유 캘린더 3개 calendarId 등록 및 테스트
3. 지점원은 개인 calendarId와 연락처 표시 동의를 본인 설정에서 관리

## 9. 일정 유형별 캘린더 분기

- 상담/후속관리 유형 → `consultation_followup` (+ 개인 캘린더 이벤트 후보)
- 교육 → `branch_common`
- 관리자 회의(팀회의+관리자+고객 미연결) → `admin`
- 휴무/취소 → 동기화 건너뜀

## 10. 안전 제목 변환 규칙 (기본 모드)

- `buildSafeGoogleCalendarTitle` — 익명 참조(A-xxx) 기반 안전 제목
- `buildSafeGoogleCalendarDescription` — targetType/정책/역할에 따라 분기
- `assertSafeGoogleCalendarEventPayload` — 민감정보 전체 차단

## 11. sync 실패/재시도 정책

- Google sync 실패는 BOA CRM 일정 저장을 rollback하지 않습니다.
- 실패 메시지는 연락처 패턴을 제거한 안전 요약만 저장합니다.

## 12. OAuth scope 기준

- `calendar.events`
- `calendar.calendarlist.readonly`

## 13. TimeTree 안내

TimeTree는 Google Calendar 외부 캘린더 구독 보조 수단입니다.

## 14. 운영 전 smoke 체크리스트

- [ ] 기본값(정책 OFF)에서 안전 제목 모드 유지
- [ ] 정책 ON 시 지점장이 설정한 범위 내 원문 동기화
- [ ] Google Calendar 공유 대상 권한 확인 후 정책 활성화
- [ ] activity_logs에 고객명·연락처·원문 제목/설명·token 없음
- [ ] secret, token, Google raw response는 어떤 경우에도 저장하지 않음

## 15. 오분류 일정 재동기화 (Hotfix Add-on)

### 목적

과거에 `branch_common`(공통일정)으로 잘못 Google Calendar에 올라간 **상담·후속관리 계열** CRM 일정을 `consultation_followup`(상담·후속관리) 캘린더로 안전하게 재동기화합니다.

### dry-run 우선 원칙

1. `resyncMisclassifiedConsultationEventsDryRun`으로 대상 건수·이동/재생성 예상을 먼저 확인합니다.
2. dry-run은 DB `schedules.calendarCategory`, `google_calendar_event_syncs`, Google Calendar를 **변경하지 않습니다**.
3. dry-run 결과의 `executeToken`은 30분 유효합니다. 만료 시 다시 dry-run해야 합니다.
4. dry-run 없이 execute를 호출할 수 없습니다.

### branch_admin 전용 실행

- dry-run / execute / 이력 조회는 **`branch_admin`만** 가능합니다.
- `sub_branch_admin`, `team_leader`, `member`, `inactive`, `resigned`는 차단됩니다.
- execute 시 확인 문구 **`상담일정 재동기화`** 입력이 필요합니다.

### 보정 기준 (`branch_common` → `consultation_followup`)

대상 탐지:

- CRM 일정 유형: 상담, 후속관리, 재연락, 보장점검, 방문상담(외근+고객연결) 계열
- 현재 `schedules.calendarCategory` 또는 `google_calendar_event_syncs.calendarType`이 `branch_common`
- 기대 분류: `consultation_followup`

### Google event 처리 순서

1. CRM `schedules.calendarCategory`를 `consultation_followup`으로 보정
2. 기존 `googleEventId` / `googleCalendarId` 확인
3. `consultation_followup` calendarId 확인 (없으면 **다른 캘린더로 대체하지 않음**)
4. move 가능 시 `events.move` 우선
5. move 실패 또는 불가 시 기존 event `delete` 후 `consultation_followup`에 `insert`
6. delete 실패 시 `needs_manual_review`
7. insert 실패 시 `resync_failed`
8. 성공 시 `google_calendar_event_syncs` 갱신 (단일 sync row 유지)

### 중복 event 방지

- 동일 BOA 일정에 Google event가 2개 남지 않도록 **기존 sync row 1건만** 갱신합니다.
- move 성공 시 새 calendarId/eventId로 업데이트합니다.
- recreate 시 기존 branch_common event 삭제 후 insert합니다.
- 실행 후 공통 캘린더에 중복 일정이 남지 않았는지 운영자가 수동 확인합니다.

### 상태값

| 결과 | 의미 |
|---|---|
| `resync_dry_run` | dry-run 완료 |
| `resync_moved` | Google `events.move` 성공 |
| `resync_recreated` | delete+insert 또는 신규 insert 성공 |
| `resync_failed` | Google/DB 갱신 실패 |
| `skipped_missing_calendar` | `consultation_followup` calendarId 미등록 |
| `needs_manual_review` | delete 실패 등 수동 확인 필요 |

### activity_logs 원문 개인정보 미저장

재동기화 관련 action:

- `GOOGLE_CALENDAR_MISCLASSIFIED_RESYNC_DRY_RUN`
- `GOOGLE_CALENDAR_MISCLASSIFIED_RESYNC_EXECUTED`
- `GOOGLE_CALENDAR_EVENT_MOVED`
- `GOOGLE_CALENDAR_EVENT_RECREATED`
- `GOOGLE_CALENDAR_EVENT_RESYNC_FAILED`
- `GOOGLE_CALENDAR_EVENT_NEEDS_MANUAL_REVIEW`

허용 metadata: `boaEventId`, `previousCalendarCategory`, `nextCalendarCategory`, `previousGoogleCalendarType`, `nextGoogleCalendarType`, `result`, `resyncMode`, `syncStatus`, 집계 카운트, `actorId`

금지: 고객명·연락처·원문 제목/설명·Google token·raw API response

dry-run API 응답에도 고객명·연락처·원문 제목은 기본 노출하지 않습니다.

### 실행 전후 운영 체크리스트

**실행 전**

- [ ] Google Calendar OAuth 연결 및 3개 공유 캘린더 calendarId 등록 확인
- [ ] `consultation_followup` 캘린더 연결 테스트 성공
- [ ] 원문 표시 정책(`syncRawTitleToGoogleCalendar` 등) 의도 확인
- [ ] dry-run으로 대상 건수·수동 확인 필요 건수 확인

**실행 후**

- [ ] 이동/재생성/실패/수동확인 건수 확인
- [ ] 공통 캘린더(`branch_common`)에 중복 일정이 남지 않았는지 확인
- [ ] `needs_manual_review` / `resync_failed` 건 수동 처리
- [ ] activity_logs에 원문 PII가 없는지 확인
