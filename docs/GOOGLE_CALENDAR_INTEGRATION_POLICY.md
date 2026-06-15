# Google Calendar Integration Policy (PR22)

## 1. 기능 목적

BOA 지점관리 CRM의 일정, 상담 예정, 후속관리, 회의/교육 일정을 Google Calendar 공유 캘린더에 안전하게 동기화합니다. TimeTree 직접 API 연동이 아니라 Google Calendar를 표준 공유 캘린더 허브로 사용합니다.

## 2. 3개 캘린더 구조

| calendarType | 표시명 | 대상 |
|---|---|---|
| `branch_common` | BOA 지점 공통 일정 | 회의, 교육, 지점 행사, 공통 공지 |
| `consultation_followup` | BOA 상담·후속관리 일정 | 상담, 후속관리, 재연락, 보장점검, 방문 |
| `admin` | BOA 관리자 일정 | 지점장/팀장/부지점장 운영 회의 |

## 3. 권한별 운영 기준

- `branch_admin`: calendarId 등록/수정/비활성, OAuth 연결, 전체 동기화 상태 조회, 실패 재시도, 테스트 동기화
- `sub_branch_admin` / `team_leader`: 산하 일정 동기화 상태 조회
- `member`: 본인 일정 동기화 상태 조회
- `inactive` / `resigned`: 전체 접근 차단

## 4. Google Calendar 수동 생성 방법

1. Google Calendar에서 새 캘린더 3개를 생성합니다.
2. 지점 공유 정책에 맞게 공유 대상을 설정합니다.
3. 캘린더 설정에서 calendarId(예: `...@group.calendar.google.com`)를 확인합니다.

## 5. calendarId 등록 방법

1. 지점장이 BOA CRM → 설정 · 도구 → Google Calendar 연동 화면으로 이동합니다.
2. Google Calendar OAuth를 연결합니다.
3. 각 캘린더 타입별 calendarId를 입력하고 저장합니다.
4. 연결 테스트로 접근 권한을 확인합니다.

## 6. 일정 유형별 캘린더 분기 기준

- `고객상담`, `재통화`, `계약예정`, `보장분석`, `해지방어` → `consultation_followup`
- `교육` → `branch_common`
- `팀회의` + 관리자 역할 + 고객 미연결 → `admin`
- `팀회의` (일반) → `branch_common`
- `외근` + 고객 연결 → `consultation_followup`, 미연결 → `branch_common`
- `휴무` / `취소` → 동기화 건너뜀
- 후속관리(`follow_up`) → `consultation_followup`

## 7. 안전 제목 변환 규칙

서버 함수:

- `buildSafeGoogleCalendarTitle`
- `buildSafeGoogleCalendarDescription`
- `assertSafeGoogleCalendarEventPayload`
- `mapBoaScheduleToGoogleCalendarType`

사용자 입력 제목을 Google Calendar에 그대로 보내지 않습니다. `[BOA]` 접두사와 일정 유형, 허용된 고객 참조 코드만 조합합니다.

## 8. 고객정보 비노출 원칙

Google Calendar 제목/설명/location에 다음을 금지합니다.

- 고객 실명, 전화번호, 주민번호 유사 패턴
- 질병명, 증권번호, 보험상품명, 보험료
- OAuth token, refresh token, raw Google API response

## 9. sync 실패/재시도 정책

- Google sync 실패는 BOA CRM 일정 저장을 rollback하지 않습니다.
- `google_calendar_event_syncs.syncStatus=failed`로 기록합니다.
- 지점장이 실패 재시도 API/UI로 재동기화할 수 있습니다.

## 10. activity_logs 기록 기준

허용 action:

- `GOOGLE_CALENDAR_INTEGRATION_UPSERTED`
- `GOOGLE_CALENDAR_INTEGRATION_DISABLED`
- `GOOGLE_CALENDAR_ACCESS_TESTED`
- `GOOGLE_CALENDAR_EVENT_SYNCED`
- `GOOGLE_CALENDAR_EVENT_SYNC_FAILED`
- `GOOGLE_CALENDAR_EVENT_DELETED`
- `GOOGLE_CALENDAR_EVENT_RETRY_REQUESTED`
- `GOOGLE_CALENDAR_OAUTH_CONNECTED`

metadata에는 `calendarType`, `boaEventType`, `boaEventId`, `syncStatus`, `safeErrorCode`, `retryCount`, `actorId`만 허용합니다.

## 11. OAuth scope 기준

최소 권한:

- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`

ACL 자동 공유는 이번 MVP 범위에서 제외하고, 수동 공유 캘린더 calendarId 등록 방식을 사용합니다.

## 12. TimeTree 안내

TimeTree는 Google Calendar 외부 캘린더 구독 표시 보조 수단입니다. BOA CRM은 TimeTree API에 직접 연동하지 않습니다.

## 13. 운영 전 smoke 체크리스트

- [ ] 지점장 OAuth 연결 성공
- [ ] 3개 calendarId 등록 및 연결 테스트 성공
- [ ] 일정 생성 후 Google Calendar 이벤트 생성 확인
- [ ] 일정 수정/취소 시 Google 이벤트 반영 확인
- [ ] 고객 실명 포함 제목이 차단되는지 확인
- [ ] activity_logs에 token/고객정보 원문이 없는지 확인
- [ ] sync 실패 시 BOA 일정은 정상 저장되는지 확인
