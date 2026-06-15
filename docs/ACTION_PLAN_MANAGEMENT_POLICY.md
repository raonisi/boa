# 지점원 실행계획 관리 정책

## 1. 기능 목적

BOA 지점관리 CRM의 지점원 실행계획 관리는 월간·주간·일일 활동 목표를 체계적으로 작성·제출·리뷰하고, 지점장이 취합해 대표 보고용 XLSX를 생성하는 **지점 운영관리** 기능입니다.

## 2. 월간·주간·일일 계획 작성 구조

| 계층 | 테이블 | 설명 |
|------|--------|------|
| 월간 | `branch_action_plans` | 월 단위 목표·전략·리스크·도움 요청 |
| 주간 | `weekly_action_plans` | 월간 계획(`monthlyPlanId`)에 연결된 주차별 실행계획 |
| 일일 | `daily_action_plans` | 주간 계획(`weeklyPlanId`)에 연결된 일일 목표·마감 회고 |
| 보고 이력 | `executive_action_plan_reports` | 대표 보고 XLSX 생성·다운로드 이력 |

프론트 `/action-plans` 화면에서 월간·주간·일일 계획을 각각 작성·임시저장·제출합니다.

## 3. 제출 / 리뷰 / 수정요청 상태 흐름

```
draft → submitted → reviewed
              ↘ revision_requested → (작성자 수정) → submitted → ...
              ↘ closed (마감)
```

- `draft` / `revision_requested`: 작성자만 수정 가능
- `submitted`: 작성자 임의 수정 불가
- 리뷰·수정요청 시 `reviewedBy`, `reviewedAt`, `managerComment` 기록

## 4. 역할별 권한

| 역할 | 조회 | 작성 | 리뷰/피드백 | 대표 XLSX |
|------|------|------|-------------|-----------|
| `branch_admin` | 전체 지점 | 본인 포함 | 전체 | 가능 |
| `sub_branch_admin` | 산하 조직 | 본인 | 산하 | 불가 |
| `team_leader` | 산하 팀원 | 본인 | 산하 팀원 | 불가 |
| `member` | 본인만 | 본인 | 불가 | 불가 |
| `inactive` / `resigned` | 차단 | 차단 | 차단 | 차단 |

권한 검증은 **서버 tRPC 라우터**에서 수행합니다.

## 5. 대표 보고용 XLSX 생성 기준

- 파일명: `BOA_대표보고_실행계획_YYYY-MM_WW.xlsx`
- 시트 6개: 대표 보고 요약, 지점원별 월간, 주간, 일일, 지점장 종합, 제출 현황
- `branch_admin`만 미리보기·다운로드 가능

## 6. 다운로드 사유 필수 정책

- `downloadReason` **5자 이상 필수**
- 사유에도 고객 식별정보 입력 금지 (서버 validator 적용)

## 7. activity_logs 기록 정책

| 이벤트 | action |
|--------|--------|
| 계획 생성 | `ACTION_PLAN_CREATED` |
| 제출 | `ACTION_PLAN_SUBMITTED` |
| 리뷰 | `ACTION_PLAN_REVIEWED` |
| 수정요청 | `ACTION_PLAN_REVISION_REQUESTED` |
| 대표 보고 다운로드 | `EXECUTIVE_ACTION_PLAN_REPORT_DOWNLOADED` |

로그 metadata에는 `reportMonth`, `reportWeekLabel`, `generatedBy`, `status`, `userCount`, `planType` 등만 저장합니다. **다운로드 사유 원문·고객정보는 저장하지 않습니다.**

## 8. 고객 민감정보 입력 금지 정책

다음 정보는 계획 본문·대표 보고서·다운로드 사유에 입력하지 않습니다.

- 고객 실명 (UI 안내; 서버는 패턴 기반 차단 보조)
- 전화번호·주민등록번호·이메일
- 질병명·상세 병력
- 보험상품명·증권번호·개별 보험료

## 9. 서버 민감정보 차단 기준

`server/actionPlanSensitiveGuard.ts` 공통 validator:

- `assertNoSensitiveActionPlanText` — 단일 필드 검사
- `assertNoSensitiveMonthlyPlanInput` / `Weekly` / `Daily` / `Executive` — 도메인별 검사
- `assertNoSensitiveActionPlanReportData` — XLSX 생성 직전 전체 검사
- `sanitizeActionPlanLogMetadata` — activity log metadata 정제

차단 패턴 예: 휴대전화·유선전화·주민번호 유사·이메일·장숫자(계좌 유사)·질병/병력 키워드·보험상품명·월납보험료 구체 문장.

에러 메시지: **「대표 보고서와 실행계획에는 고객 식별정보를 입력할 수 없습니다.」** (민감 원문 미반환)

적용 시점:

1. 계획 생성/수정/리뷰 API 입력 시
2. 대표 보고 미리보기/다운로드 입력 시
3. `executive_action_plan_reports` DB 저장 **전**
4. XLSX 버퍼 생성 **전**

## 10. migration / FK 또는 앱 레벨 무결성 기준

### Migration journal

- `0026_new_member_onboarding_checklist.sql` — 온보딩 테이블 (기존 운영 적용 대상)
- `0027_action_plans.sql` — 실행계획 테이블 (본 기능)
- `drizzle/meta/_journal.json`은 **0025 → 0026 → 0027** 순서를 반영합니다.

### FK 정책

본 프로젝트 Drizzle migration은 **DB FK 제약을 사용하지 않는 스타일**입니다 (`drizzle/*.sql` 전체에 `FOREIGN KEY` 없음).

실행계획 테이블도 동일하게:

- `weekly_action_plans.monthlyPlanId` → `branch_action_plans.id`
- `daily_action_plans.weeklyPlanId` → `weekly_action_plans.id`
- `branch_action_plans.userId` / `executive_action_plan_reports.generatedBy` → `users.id`

관계 무결성은 **서버 라우터 + unique index** (`userId+targetMonth`, `monthlyPlanId+weekStartDate`, `weeklyPlanId+planDate`)로 보장합니다.

## 11. 파일럿 운영 전 체크리스트

- [ ] 월간·주간·일일 계획 작성·임시저장·제출 (모바일 카드 UI)
- [ ] 제출 후 수정 차단·`revision_requested` 재수정
- [ ] 팀장/부지점장 산하 범위 조회·타 범위 차단
- [ ] 제출 현황·미제출자 표시
- [ ] 지점장 피드백·리뷰·수정 요청
- [ ] 대표 보고 XLSX: 사유 필수·민감정보 입력 시 차단
- [ ] 다운로드 activity log (사유 원문 미포함)
- [ ] XLSX에 고객 PII 미포함

## 12. PR21 — 지점원 직접 목표등록 (2026)

### 12.1 직접 등록 원칙

- 지점원(`member`)이 월간·주간·일일·주간복기를 **본인 계정으로 직접** 작성·제출합니다.
- `team_leader` / `sub_branch_admin` / `branch_admin`은 **타인 목표를 대신 생성하지 않습니다.**
- 지점장·팀장·부지점장은 조회·피드백·수정요청·코칭 중심입니다.
- `branch_admin` 본인 계획은 본인이 직접 입력합니다.

### 12.2 1~5주차 직접 선택

- 기준월 `YYYY-MM` + 주차 `1~5` 선택
- 지난 주차·미래 주차 모두 입력 가능, 중간 주차 건너뛰기 가능
- `userId + targetMonth + weekNumber` 유일 — 재제출 시 **기존 행 갱신**

### 12.3 고객군·상품군 입력 기준

- `targetCustomerReference`: 고객코드(`A-102`), 이니셜(`K고객`), 고객군·관리번호 수준만 허용
- `proposedProductCategory` / `proposedCoverageArea`: 상품명보다 **상품군·보장영역** 중심
- 고객 실명·전화·증권번호·질병명·고객별 민감 상담 내용 금지

### 12.4 개인정보 최소화 확인

- 월간·주간·일일 **제출 시** `privacyMinimizedConfirmed=true` 필수
- 미확인 시 서버에서 제출 차단

### 12.5 지점장 대시보드 자동 집계

- 목표 미등록자, 오늘 계획/결과 누락자, 코칭 요청자
- 월·주 목표/실적 합계·달성률, 활동 지표, 주의신호(목표미등록·계획누락·결과누락·코칭요청·활동저조)

### 12.6 Migration

- `0028_action_plan_direct_upload_fields.sql` — PR20 테이블에 nullable/기본값 컬럼 추가 (0027 수정 금지)
