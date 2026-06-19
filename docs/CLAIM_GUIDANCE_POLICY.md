# BOA CRM 청구 안내 상태 관리 정책 (PR22-1)

## 목적

고객에게 **보험금 청구 관련 안내**를 했는지, 어떤 단계까지 진행되었는지, 추가 안내가 필요한지를 **업무 상태**로 기록·관리합니다.

PR22-1은 **API·데이터 모델·RBAC·테스트**만 제공합니다. UI는 **PR22-2**에서 구현합니다.

## 보험금 청구 대행 기능이 아님

- 보험사 접수 대행, 팩스/전송, 서류 업로드, 지급 결과 확정 기능 **없음**
- `claim_guidance_cases`는 **안내 상태 관리** 전용 테이블입니다.

## 데이터 모델 (`claim_guidance_cases`)

| 필드 | 설명 |
|------|------|
| `customerId` | 대상 고객 (필수) |
| `contractId` | 연관 계약 ID (nullable, 계약번호 원문 저장 금지) |
| `guidanceType` | 안내 유형 |
| `guidanceStatus` | 전체 안내 진행 상태 |
| `documentGuideStatus` | 서류 안내 상태 |
| `customerActionStatus` | 고객 측 진행 상태 |
| `followUpId` | 기존 `follow_ups` 연결 (nullable) |
| `nextFollowUpAt` | 다음 후속 일정 (nullable) |
| `closedAt` / `closedReason` | 종료 처리 |
| `memo` | 짧은 업무 메모 (500자) |
| `deletedAt` | soft delete |

### enum (API/DB는 영문, UI는 한글 라벨)

**guidanceType:** `process_guidance`, `required_documents`, `additional_documents`, `submission_status`, `result_followup`, `other`

**guidanceStatus:** `guidance_needed`, `guidance_provided`, `waiting_customer`, `documents_preparing`, `submitted_by_customer`, `additional_guidance_needed`, `completed`, `not_applicable`, `closed`

**documentGuideStatus:** `not_started`, `guide_sent`, `customer_checking`, `completed`, `not_applicable`

**customerActionStatus:** `no_action`, `preparing`, `submitted`, `waiting_result`, `completed`, `stopped`

**closedReason:** `customer_completed`, `customer_declined`, `not_claimable_by_customer_report`, `duplicate`, `outdated`, `other`

## 민감정보 저장 금지

다음 정보는 **schema·memo·activity_logs**에 저장하지 않습니다.

- 질병명, 진단명, 병력, 병원명 상세, 검사명 상세
- 주민등록번호, 계좌번호, 전화번호, 주소
- 보험금 지급액, 보험료, 계약번호/증권번호 원문
- 진단서·영수증·세부내역서 파일/이미지

`memo`는 짧은 업무 메모만 허용하며, 민감 패턴 입력 시 API가 거부합니다.

## 후속관리 연동

- `followUpId`로 기존 `follow_ups` 행과 연결 가능 (고객 ID 일치 검증)
- `nextFollowUpAt`으로 다음 안내/후속 일정 기록
- 후속관리 **자동 생성**은 PR22-2 또는 후속 PR에서 검토 (PR22-1은 nullable 연결만)

## activity log

| action | 설명 |
|--------|------|
| `CLAIM_GUIDANCE_CREATED` | 청구 안내 생성 |
| `CLAIM_GUIDANCE_UPDATED` | 수정 |
| `CLAIM_GUIDANCE_STATUS_CHANGED` | 상태 변경 |
| `CLAIM_GUIDANCE_CLOSED` | 종료 |
| `CLAIM_GUIDANCE_DELETED` | soft delete |

metadata: `claimGuidanceCaseId`, `customerId`, `contractId`, `guidanceType`, `guidanceStatus`, `documentGuideStatus`, `customerActionStatus`, `closedReason`, `followUpId` (+ 상태 변경 시 `previousGuidanceStatus`/`nextGuidanceStatus`) — **memo·고객명·민감정보 미포함**

## 권한 (서버 RBAC)

| 역할 | 조회 | 생성/수정/종료/삭제 |
|------|------|---------------------|
| `branch_admin` | 전체 | 전체 |
| `sub_branch_admin` | 산하 | 산하 |
| `team_leader` | 팀 | 팀 |
| `member` | 본인 담당 고객 | 본인 담당 고객 |
| `inactive` / `resigned` | 차단 | 차단 |

추가 검증:

- `contractId`는 해당 `customerId` 소속 계약이어야 함
- `followUpId`는 해당 `customerId` 소속 후속관리여야 함
- 권한 밖 고객/계약/후속관리 접근 시 `FORBIDDEN` 또는 `BAD_REQUEST`

## 개인정보 최소수집

- 청구 안내 대상 고객은 **동의·최소수집** 원칙에 따라 고객 DB에 등록된 고객만 사용
- 안내 내용의 상세 의료/금융 정보는 CRM에 저장하지 않음

## API (`claimGuidance.*`)

- `list`, `listByCustomer`, `summary`
- `create`, `update`, `changeStatus`, `close`, `delete`

## PR22-2 UI 운영 (고객 상세 · 청구 안내 관리)

PR22-2는 **UI 레이어** 작업입니다. DB schema·migration·핵심 API는 PR22-1을 그대로 사용합니다.

### 고객 상세 — 청구 안내 탭

1. 고객 상세 **「청구 안내」** 탭에서 확인합니다.
2. **청구 안내 상태**, **안내 유형**, **필요서류 안내**, **고객 준비 상태**, **다음 확인일**, **연결 후속관리**, **연결 계약**(상품명·계약일)을 표시합니다.
3. 보험금 **청구 대행**·**자동 청구**·**지급 예측** 기능이 아닙니다.
4. 추가·수정·상태 변경·종료·비활성화는 RBAC 범위 내에서만 가능합니다.

### 청구 안내 관리 (`/claim-guidance`)

1. 사이드바 **「청구 안내 관리」** 또는 대시보드 요약 카드에서 진입합니다.
2. 전체·안내 필요·고객 준비 중·추가 안내 필요·완료·종료·다음 확인 예정 건수를 **기록된 청구 안내 상태** 기준으로 표시합니다.
3. 기간·담당자·팀·안내 유형·상태·고객 준비·다음 확인일 필터로 목록을 좁힐 수 있습니다.

### 다음 확인일 · 후속관리

1. **다음 확인일**(`nextFollowUpAt`)은 안내 후 재확인 일정 기록용입니다.
2. 기존 **후속관리**(`followUpId`)와 선택 연결할 수 있습니다.
3. 후속관리 **자동 생성**은 PR22-2 범위 밖이며, 필요 시 후속 PR에서 검토합니다.

### 민감정보 입력 금지 (UI)

- 추가·수정 모달 안내:  
  **「청구 안내 메모에는 질병명, 진단명, 병력, 주민등록번호, 계좌번호, 병원명 상세, 계약번호, 보험료 등 민감정보를 입력하지 마세요.」**
- 진단서·영수증·세부내역서 **파일 업로드 UI 없음**
- 계약번호 원문 강조 표시 없음 (상품명·계약일만)

## 운영 주의

1. Railway pre-deploy `pnpm db:migrate` 후 `claim_guidance_cases` 테이블 확인
2. PR22-1 migrate 배포 후 PR22-2 UI 사용 가능
