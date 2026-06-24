# BOA CRM 해지위험 관리 정책 (PR23-1)

## 목적

고객의 **해지·감액·납입 중단·불만·보험료 부담·타사 비교** 등 이탈 위험 신호를 구조화하고, 설계사의 **안내·대응·다음 확인** 이력을 기록합니다.

PR23-1은 **API·데이터 모델·RBAC·테스트**를 제공하고, PR23-2에서 **UI**를 제공합니다.

## 해지방어 강요 기능이 아님

- 고객에게 **무조건 유지를 권유**하기 위한 기능이 아닙니다.
- 고객 **선택권**과 **설명 의무**를 존중하는 관리 기능입니다.
- `no_retention_needed`, `surrendered` 등 고객 결정을 존중하는 상태를 지원합니다.

## 기존 consultStatus(`해지관리`)와의 관계

| 구분      | `customers.consultStatus = 해지관리` | `retention_risk_cases`                        |
| --------- | ------------------------------------ | --------------------------------------------- |
| 역할      | 파이프라인/목록용 상담 상태          | 해지 사유·대응·결과 상세 추적                 |
| 자동 연동 | —                                    | **자동 변경 없음** (PR23-1)                   |
| 중복      | —                                    | 별도 case 테이블, consultStatus 덮어쓰지 않음 |

## 기존 추천/후속관리와의 관계

- `recommendations.customerWarnings` / `retention_risk` 추천 사유: **독립 유지**, 새 API가 추천 엔진을 수정하지 않음
- `follow_ups`: `followUpId` nullable 연결만 (자동 생성 없음)
- `customerTags`, `priority`, `nextAction`: **중복 필드 없음**

## 데이터 모델 (`retention_risk_cases`)

| 필드                              | 설명                           |
| --------------------------------- | ------------------------------ |
| `customerId`                      | 대상 고객 (필수)               |
| `contractId`                      | 연관 계약 (nullable)           |
| `riskReason`                      | 해지위험 사유                  |
| `riskLevel`                       | low / medium / high / critical |
| `retentionStatus`                 | 대응 진행 상태                 |
| `responseStrategy`                | 대응 방향                      |
| `customerSentiment`               | 고객 정서(업무 분류)           |
| `financialPressureLevel`          | nullable                       |
| `competitorMentioned`             | 타사 언급 여부                 |
| `followUpId` / `nextFollowUpAt`   | 후속 연결                      |
| `resolvedAt` / `resolutionResult` | 종료 처리                      |
| `memo`                            | 짧은 업무 메모 (500자)         |
| `deletedAt`                       | soft delete                    |

민감정보·계약번호 원문·보험료 원문·질병명·고객 불만 전문 필드 **없음**.

## 중복 case 방지

동일 고객에 **진행 중**(terminal 상태 아님) active case가 있으면 신규 생성을 `BAD_REQUEST`로 차단합니다.

Terminal 상태: `retained`, `adjusted`, `surrendered`, `closed`

## activity log

| action                          | 설명           |
| ------------------------------- | -------------- |
| `RETENTION_RISK_CREATED`        | 생성           |
| `RETENTION_RISK_LEVEL_CHANGED`  | 위험 단계 변경 |
| `RETENTION_RISK_STATUS_CHANGED` | 대응 상태 변경 |
| `RETENTION_RISK_UPDATED`        | 수정           |
| `RETENTION_RISK_RESOLVED`       | 종료/결과 기록 |
| `RETENTION_RISK_DELETED`        | soft delete    |

metadata: case ID·enum 상태만 — **memo·고객명·전화번호·민감정보 미포함**

## 권한 (서버 RBAC)

| 역할                    | 조회           | 생성/수정/종료/삭제 |
| ----------------------- | -------------- | ------------------- |
| `branch_admin`          | 전체           | 전체                |
| `sub_branch_admin`      | 산하           | 산하                |
| `team_leader`           | 팀             | 팀                  |
| `member`                | 본인 담당 고객 | 본인 담당 고객      |
| `inactive` / `resigned` | 차단           | 차단                |

## API (`retentionRisk.*`)

- `list`, `listByCustomer`, `summary`
- `create`, `update`, `changeRiskLevel`, `changeRetentionStatus`, `resolve`, `delete`

## PR23-2 UI 운영 (구현 완료)

### 고객 상세 — 해지위험 관리 탭

- 경로: 고객 상세 → **해지위험** 탭
- 표시: 위험 단계, 해지 고민 사유, 고객 반응, 대응 방향, 다음 확인일, 연결 후속관리, 종료 결과, 짧은 메모
- 작업: 추가, 상태 변경(위험 단계·관리 상태), 종료 처리, 수정, 비활성화
- 안내 문구: 고객 선택권 존중, 민감정보 입력 금지

### 관리자 해지위험 현황

- 경로: `/retention-risk` (사이드바 **해지위험 관리**)
- KPI: 전체, 긴급/높은 위험, 고객 고민 중, 조정 검토, 유지/해지 처리, 다음 확인 예정
- 필터: 기간, 담당자, 팀, 위험 단계, 사유, 관리 상태, 결과 상태, 다음 확인일
- 모바일: 카드형 리스트

### 대시보드 요약 카드

- 긴급 해지위험, 다음 확인 예정, 조정 검토 중 (기록된 상태 기준, 예측/확률 표현 없음)

### 다음 확인일 처리

- `nextFollowUpAt` 직접 입력 또는 기존 `followUpId` 연결
- 후속관리 **자동 생성 없음** — 기존 follow_ups API 유지

### UI 금지 표현

- “반드시 유지”, “무조건 해지 방어”, “유지율”, “해지 확률” 등 압박·공포 조장 표현 사용 금지

## 운영 주의

1. Railway pre-deploy `pnpm db:migrate` 후 `retention_risk_cases` 확인
2. PR23-1 API 배포 후 PR23-2 UI 사용 가능
