# 신규 로드맵 PR6. 운영 리스크 센터

이 문서의 PR6는 2026 신규 로드맵 기준의 **운영 리스크 센터**를 의미한다. 기존 HANDOFF의 과거 PR6 "모바일 빠른 업무 UX"와 별도이며, 신규 PR5 영업 퍼널·성과 리포트(`/analytics`)와도 분리된다.

## 목적

branch_admin이 데이터 다운로드, 삭제·복구, 계정·권한, 인수인계, 푸시 실패, 미처리 업무 등 운영상 위험 신호를 한 화면에서 확인하고 관련 화면으로 이동해 수동 조치할 수 있게 한다.

이번 PR6는 탐지·가시화·점검·관리자 조치 안내만 제공한다. 자동 cron, 자동 계정 비활성화, 자동 권한 변경, 자동 담당자 변경, 자동 인수인계, 자동 삭제·복구, 자동 고객 상태 변경은 포함하지 않는다.

## 범위 구분

- 신규 PR5: 영업 퍼널, 성과 리포트, 전환율, 목표 대비 실적.
- 신규 PR6: 운영 리스크, 보안 점검, 위험 작업, 다운로드/삭제/인수인계/푸시/로그 이상.
- PR19-4 성격: 알림 preference, quiet hours, 발송 제어 고도화. 이번 PR6에서는 전체 구현하지 않는다.
- 상담도구관리 스크립트 CRUD hotfix: 이번 PR6 범위가 아니다.

## 리스크 등급

| 등급 | 기준 |
| --- | --- |
| 정상 | 위험 이벤트가 없거나 낮은 수준 |
| 주의 | 확인 필요한 이벤트 존재 |
| 경고 | 반복 이벤트 또는 민감 작업 존재 |
| 위험 | 대량 다운로드, 완전삭제, 강제 로그아웃, OAuth 초기화, 퇴사자 미처리 등 즉시 확인 필요 |

점수는 0~100점 범위의 계산값이며 저장하지 않는다. 운영 데이터가 누적되면 임계값은 파일럿 운영 중 조정할 수 있다.

## 데이터 source

| 리스크 | source |
| --- | --- |
| 데이터 다운로드 | `activity_logs.DATA_DOWNLOAD`, 다운로드 metadata reason/rowCount |
| 삭제·복구 | `delete_requests`, 삭제/복구/완전삭제 관련 `activity_logs` |
| 권한·계정 | `users`, 로그인 차단, 강제 로그아웃, OAuth 초기화, 권한 변경 `activity_logs` |
| 인수인계 | `handoff_histories`, inactive/resigned 사용자에게 남은 고객/계약/후속관리/일정/알림 |
| 푸시 알림 | `push_notification_logs`, `user_device_tokens` 요약 |
| 미처리 업무 | 미처리 `follow_ups`, 오래된 `schedules`, 미확인 `notifications`, pending delete request |
| 최근 고위험 로그 | 기존 `activity_logs`의 실제 action 이름 |

## 권한

- `/operation-risk` 화면은 branch_admin 전용이다.
- `operationRisk.*` API는 서버의 `branchAdminProcedure`로 보호한다.
- sub_branch_admin, team_leader, member, inactive, resigned는 직접 API 호출도 차단한다.
- 프론트 메뉴 숨김은 보조 수단이며 권한 판단은 서버 라우터에서 수행한다.

## 개인정보/민감정보 제한

- 고객 전화번호 전체, 상담기록 본문 전문, 질병명, 보험상품명, 보험료 상세 전문을 응답에 포함하지 않는다.
- token 원문과 secret 계열 값은 응답/로그에 포함하지 않는다.
- push title/body 정책은 변경하지 않으며 고객명, 전화번호, 질병명, 상품명, 보험료를 추가하지 않는다.
- 이번 PR6는 activity_logs를 삭제하거나 조회 로그를 과도하게 생성하지 않는다.
- 다운로드/export 기능을 새로 확장하지 않는다.

## UAT 체크리스트

1. branch_admin으로 `/operation-risk`에 접근한다.
2. 기간 필터(오늘, 최근 7일, 최근 30일, 이번 달, 직접 선택)를 변경한다.
3. 종합 리스크 등급과 위험 작업 요약 카드가 깨지지 않는지 확인한다.
4. 데이터 다운로드, 삭제·복구, 권한·계정, 인수인계, 푸시, 미처리 업무 카드의 숫자와 관련 화면 이동을 확인한다.
5. 최근 고위험 로그에 raw JSON, token 원문, 전화번호 전체, 상담 본문 전문이 보이지 않는지 확인한다.
6. sub_branch_admin, team_leader, member로 직접 URL 접근 시 차단되는지 확인한다.
7. 모바일/Android WebView에서 카드가 세로로 정리되고 가로 스크롤이 생기지 않는지 확인한다.
8. PR5 `/analytics` 영업 퍼널 화면과 PR6 운영 리스크 센터 내용이 섞이지 않는지 확인한다.

## 운영점검 통합 정책

- `/operation-risk`를 운영 리스크와 감사 확인의 canonical 운영 허브로 사용한다.
- 기존 `/admin-audit` 직접 접근은 `/operation-risk?tab=logs`로 이동시켜 운영점검 북마크가 404가 되지 않게 한다.
- `/logs`는 기존 활동 로그 화면으로 유지하며, 운영 리스크 센터의 branch_admin 전용 권한으로 흡수하지 않는다.
- 운영점검의 상세 감사 로그 필터와 DATA_DOWNLOAD 사유 확인은 운영 리스크 센터의 "상세 운영 로그" 탭에서 확인한다.
- 운영점검의 운영 건강도와 시스템 상태 카드는 운영 리스크 센터의 "운영 상태" 탭에서 확인한다.
- `operationRisk.*`, `adminAudit.logSearch`, `logs.list`는 유지한다. `adminAudit.summary`는 즉시 삭제하지 않고 후속 cleanup 후보로만 둔다.
- 새 DB migration은 없다.
- `activity_logs` 구조와 DATA_DOWNLOAD 정책은 변경하지 않는다.
- token 원문, secret, password, DATABASE_URL, 전화번호 전체, 상담 본문 전문, 질병명, 보험상품명, 보험료 상세 전문은 운영 로그 탭에 노출하지 않는다.
## Permanent Delete Audit Linkage

- Customer/contract permanent delete is retained as a controlled branch_admin-only operation.
- Blocked permanent-delete attempts must remain visible as auditable risk events through `PERMANENT_DELETE_BLOCKED`.
- QA should verify that permanent-delete logs show safe metadata only and do not expose full phone numbers, tokens, secrets, consultation body text, disease names, product names, or premium detail text.

## Activity Log Redaction Policy

- Operation-risk, admin-audit, and activity-log responses must never expose raw `activity_logs.details` when it contains token, secret, password, API key, `DATABASE_URL`, authorization, cookie, session, device token, or FCM token values.
- Full phone numbers, birth dates, resident-number-like patterns, and emails are masked in audit/log surfaces only.
- Consultation body, customer memo, message/template/script body, illness/product names, and premium detail text are summarized in audit/log surfaces.
- DATA_DOWNLOAD reasons remain visible for audit context, but sensitive patterns inside the reason are redacted.
- Customer DB, Customer Detail, follow-up, schedule, mobile customer card, and assigned-member customer views continue to show authorized customer contact and birth-date information for normal work.
- Legacy logs are protected at response/display time even if older stored `activity_logs.details` contain unsafe metadata.
- Historical DB rows can be remediated with `pnpm.cmd activity-logs:redact` for dry-run and `CONFIRM_REDACT_ACTIVITY_LOGS=1 pnpm.cmd activity-logs:redact -- --write` for controlled write mode. The command reports counts only and never prints log details.
