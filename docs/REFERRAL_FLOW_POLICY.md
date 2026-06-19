# BOA CRM 소개 흐름 정책 (PR21-1)

## 목적

PR20 **고객 관계도**(`customer_relationships`) 위에, 소개자·피소개자 간 **단계·결과·감사 연락·성과**를 추적합니다.

PR21-1은 **API·데이터 모델·RBAC·테스트**만 제공합니다. UI는 **PR21-2**에서 구현합니다.

## PR20 고객 관계도와의 관계

| 구분 | PR20 `customer_relationships` | PR21 `customer_referrals` |
|------|------------------------------|---------------------------|
| 역할 | 고객 간 관계 원본 (링크) | 소개 단계·결과·감사 상태 |
| 필수 연결 | — | `relationshipId` → PR20 관계 ID |
| 독립 생성 | 가능 | **불가** (relationshipId 필수) |

허용 관계 유형: `referral`, `friend`, `coworker`, `family_sibling`, `corporate_representative`, `corporate_employee`

## 소개 단계 (`referralStage`)

`introduced` → `contact_ready` → `contacted` → `consultation_scheduled` → `consultation_completed` → `proposal_made` → `contracted` / `deferred` / `declined` / `closed`

단계 변경 시 관련 타임스탬프(`firstContactedAt` 등)가 자동 기록될 수 있습니다.

## 감사 연락 (`thankYouStatus`)

- `not_required` — 감사 연락 불필요
- `pending` — 대기
- `completed` — 완료 (`thankYouCompletedAt` 기록)

## 권한 (서버 RBAC)

| 역할 | 조회 | 생성/수정/삭제 |
|------|------|----------------|
| `branch_admin` | 전체 | 전체 (양쪽 고객 범위 내) |
| `sub_branch_admin` | 산하 | 산하 |
| `team_leader` | 팀 | 팀 |
| `member` | 본인 담당 고객이 소개자/피소개자인 흐름 | **anchorCustomerId**가 본인 담당 고객 |
| `inactive` / `resigned` | 차단 | 차단 |

## 개인정보 / 민감정보

- `memo`는 짧은 업무 메모(500자)만 허용
- **전화번호를 `customer_referrals`에 저장하지 않음** — 피소개자는 고객 DB 등록 후 연결
- 주민등록번호, 질병명, 병력, 보험료, 계약번호 입력·로그 저장 금지

## activity log

| action | 설명 |
|--------|------|
| `REFERRAL_CREATED` | 소개 흐름 생성 |
| `REFERRAL_UPDATED` | 수정 |
| `REFERRAL_STAGE_CHANGED` | 단계 변경 |
| `REFERRAL_THANK_YOU_COMPLETED` | 감사 연락 완료 |
| `REFERRAL_DELETED` | soft delete |

metadata: `referralId`, `relationshipId`, `referralStage`, `referralSourceType`, `thankYouStatus`, `resultStatus` (+ 단계 변경 시 `previousStage`/`nextStage`) — **memo·고객명·전화번호 미포함**

## 운영 주의

1. 소개받은 고객은 **동의·최소수집** 원칙에 따라 고객 DB에 먼저 등록
2. Railway pre-deploy `pnpm db:migrate` 후 `customer_referrals` 테이블 확인
3. PR21-2에서 고객 상세·관리자 소개 현황·대시보드 UI 예정

## PR21-2 UI 운영 (고객 상세 · 소개 관리)

PR21-2는 **UI 레이어** 작업입니다. DB schema·migration·핵심 API는 PR21-1을 그대로 사용합니다.

### 고객 상세 — 소개 흐름 탭

1. 고객 상세 화면 **「소개 흐름」** 탭에서 확인합니다.
2. **「이 고객이 소개한 고객」** / **「이 고객을 소개한 고객」** 두 구역으로 표시됩니다.
3. 소개 흐름 추가 전에 **「연결 고객」** 탭에서 PR20 관계(`referral` 등 허용 유형)를 먼저 등록해야 합니다.
4. 피소개자는 **고객 DB에 등록된 고객**만 검색·선택할 수 있습니다. 외부 연락처를 referral 테이블에 직접 입력하지 않습니다.
5. 카드에서 단계 badge, 담당자, 상담상태, 감사 연락, 메모, 연결 고객 상세 이동, 단계 변경·감사 완료·수정·비활성화를 처리합니다.

### 관리자 소개 현황 (`/referrals`)

1. 사이드바 **「소개 관리」** 또는 대시보드 요약 카드에서 진입합니다.
2. 전체·진행 중·계약 완료·보류/거절·감사 미완료 건수와 팀원별·단계별 현황을 **기록된 소개 흐름 기준** 숫자로 표시합니다.
3. 기간·담당자·팀·단계·결과·감사 연락 필터로 목록을 좁힐 수 있습니다.
4. `member`는 본인 관련 소개만, 관리자 역할은 RBAC 범위 내 전체(또는 산하)를 조회합니다.

### 감사 연락 완료 처리

1. 소개자가 본인 담당 고객인 **「이 고객이 소개한 고객」** 흐름에서 `thankYouStatus = pending`일 때 **「감사 완료」** 버튼이 표시됩니다.
2. 완료 시 `thankYouStatus = completed`, `thankYouCompletedAt`이 기록되며 버튼은 사라집니다.
3. 감사 연락은 소개자에 대한 예의 연락 업무 기록이며, 고객 민감정보를 포함하지 않습니다.

### 민감정보 입력 금지 (UI)

- 소개 추가·수정 모달에 다음 안내를 표시합니다:
  **「소개 메모에는 주민등록번호, 질병명, 병력, 계약번호, 보험료 등 민감정보를 입력하지 마세요.」**
- 메모는 짧은 업무 메모(500자)만 입력합니다.
- 소개받은 고객은 **고객 동의와 개인정보 최소수집** 원칙에 따라 고객 DB에 등록한 뒤 연결합니다.

## API (`customerReferrals.*`)

- `list`, `listByCustomer`, `summary`, `searchCustomers`
- `create`, `update`, `changeStage`, `completeThankYou`, `delete`
