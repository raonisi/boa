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

## 3. 원문 동기화 정책 (branch_admin 전용)

`google_calendar_org_settings` 설정 (모두 기본값 `false`):

| 설정 | 설명 |
|---|---|
| `syncRawTitleToGoogleCalendar` | BOA CRM 입력 제목을 Google Calendar에 그대로 표시 |
| `syncRawDescriptionToGoogleCalendar` | BOA CRM 입력 설명을 Google Calendar에 그대로 표시 |
| `allowCustomerNameInGoogleCalendar` | 제목·설명에 고객 이름 표시 허용 |
| `allowCustomerContactInGoogleCalendar` | 제목·설명에 고객 연락처 표시 허용 |

### 운영 방식

- 설정이 `false`이면 기존 안전 제목/설명 모드를 사용합니다 (`[BOA] 상담 예정 · A-102` 형식).
- 설정이 `true`이면 사용자가 입력한 제목/설명과 고객명/연락처를 Google Calendar에 반영할 수 있습니다.
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