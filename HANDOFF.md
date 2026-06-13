# 보험 CRM 시스템 - Codex 인수인계 문서

## 📋 프로젝트 개요

**프로젝트명**: 보험 영업 사내 전산 CRM  
**목적**: 보험 영업팀의 고객 관리, 계약 관리, 실적 관리, 일정 관리를 통합 관리하는 웹 기반 CRM 시스템  
**상태**: 10차 수정 작업 완료 (고객 DB 일괄 업로드 기능 구현)  
**마지막 업데이트**: 2026-05-11

---

## 🛠 기술 스택

| 계층                       | 기술                                                                              |
| -------------------------- | --------------------------------------------------------------------------------- |
| **Frontend**               | React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui                                |
| **Backend**                | Express 4 + tRPC 11 + Node.js                                                     |
| **Database**               | MySQL/TiDB + Drizzle ORM                                                          |
| **Authentication**         | Google OAuth 2.0 Web Server Flow                                                  |
| **Testing**                | Vitest + React Testing Library                                                    |
| **Build**                  | Vite + pnpm                                                                       |
| **Deployment**             | Railway / Node.js hosting                                                         |
| **Pilot field mobile app** | Flutter (`apps/boa`) — Native + WebView hybrid                                    |
| **Legacy mobile shell**    | Capacitor (`capacitor.config.ts`, root `android/app`) — fallback, not removed yet |

모바일 앱 역할 분리·보안·로드맵은 [docs/MOBILE_APP_ARCHITECTURE.md](docs/MOBILE_APP_ARCHITECTURE.md)를 기준으로 한다.

---

## 🚀 실행 방법

### 1. 환경 설정

```bash
# 저장소 클론
git clone https://github.com/raonisi/boa.git
cd boa

# 의존성 설치
pnpm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 파일을 열고 실제 값 입력
```

### 2. 환경변수 설정

필수 환경변수 (`.env.local`):

```
DATABASE_URL=mysql://user:password@host:3306/insurance_crm
JWT_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.example/api/oauth/callback
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
OWNER_GOOGLE_EMAIL=owner@example.com
OWNER_OPEN_ID=owner_open_id
BUILT_IN_FORGE_API_URL=https://api.manus.im/forge
BUILT_IN_FORGE_API_KEY=your_api_key
VITE_FRONTEND_FORGE_API_KEY=frontend_api_key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im/forge
VITE_APP_TITLE=보험 영업 사내 전산 CRM
VITE_APP_LOGO=https://example.com/logo.png
```

### 3. 데이터베이스 마이그레이션

```bash
# 마이그레이션 파일 생성 (스키마 변경 시)
pnpm drizzle-kit generate

# 마이그레이션 적용
pnpm drizzle-kit migrate

# 또는 수동으로 SQL 실행
# drizzle/migrations/*.sql 파일을 데이터베이스에서 실행
```

### 4. 개발 서버 실행

```bash
# 개발 서버 시작
pnpm dev

# 서버 실행 (http://localhost:3000)
# Vite HMR 자동 재로드 활성화
```

### 5. 테스트 실행

```bash
# 모든 테스트 실행
pnpm test

# 특정 테스트 파일 실행
pnpm test server/bulk-import.test.ts

# 테스트 커버리지
pnpm test:coverage
```

### 6. 빌드 및 배포

```bash
# 프로덕션 빌드
pnpm build

# Railway 배포: Google OAuth 환경변수만 설정
```

---

## 📁 프로젝트 구조

```
insurance-crm/
├── client/                          # React 프론트엔드
│   ├── src/
│   │   ├── pages/                  # 페이지 컴포넌트
│   │   │   ├── Dashboard.tsx       # 대시보드 (권한별 뷰)
│   │   │   ├── CustomerList.tsx    # 고객 목록
│   │   │   ├── CustomerDetail.tsx  # 고객 상세
│   │   │   ├── CustomerAssign.tsx  # DB 배정
│   │   │   ├── CustomerBulkImport.tsx  # 고객 일괄 등록 (NEW)
│   │   │   ├── ContractList.tsx    # 계약 관리
│   │   │   ├── Performance.tsx      # 실적 관리
│   │   │   ├── Calendar.tsx         # 일정 캘린더
│   │   │   ├── Notifications.tsx    # 알림센터
│   │   │   ├── UserManagement.tsx   # 사용자 관리 (관리자)
│   │   │   ├── TeamManagement.tsx   # 팀 관리 (관리자)
│   │   │   ├── ActivityLog.tsx      # 활동 로그 (관리자)
│   │   │   ├── Download.tsx         # 데이터 다운로드 (관리자)
│   │   │   ├── Settings.tsx         # 설정 (관리자)
│   │   │   └── ...
│   │   ├── components/              # 재사용 컴포넌트
│   │   │   ├── DashboardLayout.tsx  # 사이드바 레이아웃
│   │   │   ├── Map.tsx              # Google Maps 통합
│   │   │   ├── AIChatBox.tsx        # AI 채팅
│   │   │   └── ui/                  # shadcn/ui 컴포넌트
│   │   ├── contexts/                # React Context
│   │   ├── hooks/                   # Custom Hooks
│   │   ├── lib/trpc.ts              # tRPC 클라이언트
│   │   ├── App.tsx                  # 라우팅
│   │   └── main.tsx                 # 진입점
│   ├── public/                      # 정적 파일 (favicon, robots.txt만)
│   └── index.html
│
├── server/                          # Express 백엔드
│   ├── routers.ts                  # tRPC 라우터 (모든 API)
│   ├── db.ts                       # DB 쿼리 헬퍼 + bulk import 함수
│   ├── bulk-import.test.ts         # 일괄 등록 테스트 (NEW)
│   ├── auth.logout.test.ts         # 로그아웃 테스트
│   ├── storage.ts                  # S3 파일 저장소
│   └── _core/                      # 프레임워크 코어
│       ├── context.ts              # tRPC 컨텍스트
│       ├── oauth.ts                # OAuth 처리
│       ├── llm.ts                  # LLM API 호출
│       ├── voiceTranscription.ts   # 음성 인식
│       ├── imageGeneration.ts      # 이미지 생성
│       ├── map.ts                  # Maps API
│       ├── notification.ts         # 알림 발송
│       └── env.ts                  # 환경변수
│
├── drizzle/                         # Drizzle ORM
│   ├── schema.ts                   # DB 스키마 정의
│   └── migrations/                 # SQL 마이그레이션 파일
│
├── shared/                          # 공유 타입/상수
│   ├── types.ts
│   └── constants.ts
│
├── storage/                         # S3 저장소 헬퍼
│   └── index.ts
│
├── package.json                     # 의존성 정의
├── pnpm-lock.yaml                   # 잠금 파일
├── tsconfig.json                    # TypeScript 설정
├── vite.config.ts                   # Vite 설정
├── vitest.config.ts                 # Vitest 설정
├── drizzle.config.ts                # Drizzle 설정
├── .env.example                     # 환경변수 템플릿
├── HANDOFF.md                       # 이 파일
└── README.md                        # 프로젝트 개요
```

---

## ✅ 현재 구현 완료 기능

### 1단계: 기본 기능 (v1)

- [x] 사용자 인증 (Google OAuth 2.0 direct)
- [x] 역할 기반 접근 제어 (RBAC): branch_admin, sub_branch_admin, team_leader, member
- [x] 고객 DB 관리 (CRUD)
- [x] 계약 관리
- [x] 상담 기록
- [x] 일정 관리
- [x] 실적 관리 (차트)
- [x] 알림 시스템
- [x] 활동 로그

### 2단계: 고도화 (v2-v7)

- [x] 조직 계층 구조 (지점장 → 부지점장 → 팀장 → 팀원)
- [x] DB 배정 기능 (지점장 → 부지점장, 부지점장 → 팀)
- [x] 고객 상세 정보 (기본정보/상담기록/계약정보/배정이력/상태변경이력)
- [x] 모바일 UI 최적화
- [x] 데이터 다운로드 (CSV)
- [x] 설정 관리
- [x] 신규 사용자 추가 (초대 링크)
- [x] 알림 필터 및 페이지네이션
- [x] 팀 관리 UI (계층 구조)
- [x] 사용자 관리 UI (권한, 팀, 부지점장 배치)

### 3단계: 고객 DB 일괄 업로드 (v10) ✅ NEW

- [x] 서버 라우터 (previewImport, bulkImport, downloadImportTemplate)
- [x] 프론트 UI (파일 선택 → 검증 → 등록)
- [x] 14가지 검증 로직 (필수값, 형식, 중복, 금지 컬럼, 조직 정합성)
- [x] 연락처 정규화 (숫자만 추출)
- [x] 파일 내 중복 검증
- [x] 기존 DB 중복 검증
- [x] 부지점장/팀/담당자 이름 기반 매핑 (동명이인 처리)
- [x] assignmentStatus 자동 계산
- [x] importBatchId 생성 및 로그 기록
- [x] 테스트 (33개 테스트 케이스)

---

## 📝 DB 스키마 주요 테이블

| 테이블               | 목적               | 주요 컬럼                                                                                                                                                          |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users`              | 사용자             | id, email, name, role, accountStatus, teamId, subBranchAdminId, phone, memo, loginStatus                                                                           |
| `teams`              | 팀                 | id, name, subBranchAdminId, description, isActive                                                                                                                  |
| `customers`          | 고객               | id, name, phone, birthDate, gender, region, expectedPremium, consultationStatus, assignedUserId, assignedTeamId, subBranchAdminId, assignmentStatus, importBatchId |
| `consultations`      | 상담 기록          | id, customerId, consultationType, notes, nextFollowUpAt                                                                                                            |
| `contracts`          | 계약               | id, customerId, productName, insuranceCompany, contractDate, paymentStatus, ownerUserId                                                                            |
| `schedules`          | 일정               | id, title, startTime, endTime, teamId, userId, completed, reminder                                                                                                 |
| `notifications`      | 알림               | id, userId, title, content, type, processStatus, isRead                                                                                                            |
| `activity_logs`      | 활동 로그          | id, userId, action, entityType, entityId, before, after                                                                                                            |
| `settings`           | 설정               | id, key, value                                                                                                                                                     |
| `status_history`     | 상담상태 변경 이력 | id, customerId, previousStatus, newStatus, changedAt                                                                                                               |
| `assignment_history` | 배정 이력          | id, customerId, previousAssignee, newAssignee, assignedAt                                                                                                          |
| `contract_history`   | 계약 변경 이력     | id, contractId, fieldName, before, after, changedAt                                                                                                                |

---

## 🔐 권한 구조

### 역할별 권한

| 기능            | 지점장 | 부지점장 | 팀장 | 팀원      |
| --------------- | ------ | -------- | ---- | --------- |
| 대시보드        | 전체   | 산하 팀  | 팀   | 본인      |
| 고객 조회       | 전체   | 산하 팀  | 팀   | 본인 배정 |
| 고객 추가       | ✅     | ✅       | ✅   | ❌        |
| 고객 일괄 등록  | ✅     | ❌       | ❌   | ❌        |
| DB 배정         | ✅     | ✅       | ❌   | ❌        |
| 사용자 관리     | ✅     | ❌       | ❌   | ❌        |
| 팀 관리         | ✅     | ❌       | ❌   | ❌        |
| 데이터 다운로드 | ✅     | ❌       | ❌   | ❌        |
| 활동 로그 조회  | ✅     | ✅       | ✅   | ❌        |

### 서버 미들웨어

```typescript
// server/routers.ts에 정의된 권한 미들웨어
- publicProcedure: 인증 불필요
- protectedProcedure: 인증 필요
- branchAdminProcedure: 지점장만
- subBranchAdminProcedure: 부지점장만
- subBranchAdminOrAboveGuard: 부지점장 이상
- adminProcedure: 지점장만 (별칭)
```

---

## 🔄 고객 일괄 업로드 기능 상세

### 파일 형식 (CSV)

```csv
이름,연락처,생년월일,성별,지역,예상보험료,통화가능시간,유입경로,상담상태,메모,부지점장,팀,담당자
홍길동,010-1234-5678,1990-01-15,남,서울,5000,09:00-18:00,지인,미상담,테스트,김부지점장,영업팀,이팀장
```

### 검증 규칙 (14가지)

1. **필수값**: 이름, 연락처
2. **형식**: 생년월일 (YYYY-MM-DD), 예상보험료 (숫자)
3. **선택값**: 성별 (남/여/기타), 상담상태 (미상담/부재/통화완료/상담예정/설계중/계약/보류/거절)
4. **연락처**: 최소 10자 이상
5. **중복**: 파일 내 중복 감지 (정규화된 연락처 기준)
6. **기존 DB**: 기존 고객과 중복 감지
7. **금지 컬럼**: 주민번호, 증권번호, 계좌번호, 카드번호 포함 시 차단
8. **부지점장**: 이름 기반 조회 (동명이인 시 오류)
9. **팀**: 부지점장 산하 팀 확인
10. **담당자**: 팀 산하 팀원 확인 (role=member, accountStatus=active)
11. **assignmentStatus**: 자동 계산 (담당자 있음→assigned_to_agent, 부지점장만→assigned_to_sub_branch, 없음→unassigned)
12. **importBatchId**: 고유 배치 ID 생성 (batch*${timestamp}*${random})
13. **로그 기록**: CUSTOMER_BULK_IMPORTED, DATA_IMPORT 로그
14. **재검증**: 최종 저장 전 서버에서 재검증

### 라우터

```typescript
// CSV 양식 다운로드
customers.downloadImportTemplate()
→ { headers: string[], csvContent: string }

// 파일 검증 및 미리보기
customers.previewImport({ rows: ParsedRow[] })
→ {
    totalRows: number,
    successRows: number,
    failedRows: number,
    validationResults: ValidationResult[]
}

// 최종 저장
customers.bulkImport({ rows: ParsedRow[], fileName: string })
→ {
    importBatchId: string,
    totalImported: number,
    failedRows: FailedRow[],
    errors: string[]
}
```

---

## 🧪 테스트 방법

### 단위 테스트 실행

```bash
# 모든 테스트
pnpm test

# 특정 테스트 파일
pnpm test server/bulk-import.test.ts
pnpm test server/auth.logout.test.ts

# Watch 모드
pnpm test --watch

# 커버리지 리포트
pnpm test --coverage
```

### 테스트 파일 위치

- `server/bulk-import.test.ts` - 일괄 등록 기능 (33개 테스트)
- `server/auth.logout.test.ts` - 로그아웃 기능

### 샘플 CSV 파일

`samples/bulk-import-sample.csv` - 테스트용 샘플 데이터 포함

---

## ⚠️ 주의사항

### 1. 권한 검증

- 모든 라우터에서 `ctx.user` 검증 필수
- 고객 조회 시 소유권 검증 (customerId → userId 매핑)
- 팀 관리 시 부지점장 범위 검증

### 2. 조직 정합성

- 사용자 이동 시 팀/부지점장 동기화 필요
- 팀 변경 시 부지점장 자동 업데이트
- 부지점장 변경 시 기존 팀 해제 후 처리

### 3. 데이터 보안

- 민감정보 (주민번호, 증권번호 등) 절대 저장 금지
- 파일 업로드 시 서버 검증 필수
- CSV 내 금지 컬럼 감지 로직 필수

### 4. 연락처 정규화

- 모든 연락처는 숫자만 추출하여 저장
- 중복 검증 시 정규화된 연락처 기준
- 국제 전화번호 지원 (선택사항)

### 5. 배치 작업

- importBatchId로 일괄 등록 추적 가능
- 실패한 행은 별도 저장 및 재업로드 가능
- 로그 기록 (CUSTOMER_BULK_IMPORTED, DATA_IMPORT)

---

## 📊 최근 검수 결과 (v10)

### 완료된 항목

- ✅ 서버 라우터 3개 구현 (previewImport, bulkImport, downloadImportTemplate)
- ✅ 프론트 UI 구현 (450줄, 3단계 워크플로우)
- ✅ 14가지 검증 로직 구현
- ✅ 테스트 33개 작성
- ✅ 기존 기능 회귀 테스트 통과

### 알려진 제한사항

- CSV 파싱만 구현 (XLSX는 향후 구현)
- 파일 크기 제한 5MB
- 한 번에 최대 1000행 추천 (성능상)

---

## 📋 남은 작업 (Codex 인수인계)

### 높은 우선순위 (즉시 필요)

- [ ] XLSX 파일 지원 추가 (xlsx 패키지)
- [ ] 오류 행 CSV 다운로드 기능
- [ ] 일괄 등록 진행률 표시 (대용량 파일)
- [ ] 배치 이력 조회 페이지 (관리자)
- [ ] 일괄 등록 취소 기능

### 중간 우선순위 (1-2주)

- [ ] 고객 수정 UI 개선 (CustomerDetail 기본정보 탭)
- [ ] 상담기록 수정 기능 강화
- [ ] 계약 관리 필터 확장
- [ ] 실적 필터 추가 (상품군, 보험사, 지역, 유입경로)
- [ ] 모바일 UI 최적화

### 낮은 우선순위 (향후)

- [ ] 고급 분석 대시보드
- [ ] 자동 재상담 알림
- [ ] 이메일 연동
- [ ] SMS 발송 기능
- [ ] 다국어 지원

---

## 🔧 문제 해결

### 개발 서버 시작 안 됨

```bash
# 포트 충돌 확인
lsof -i :3000

# 의존성 재설치
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 캐시 삭제
pnpm store prune
```

### 데이터베이스 연결 실패

```bash
# DATABASE_URL 확인
echo $DATABASE_URL

# 마이그레이션 상태 확인
pnpm drizzle-kit check

# 수동 마이그레이션
mysql -u user -p < drizzle/migrations/0001_init.sql
```

### 테스트 실패

```bash
# 테스트 로그 확인
pnpm test --reporter=verbose

# 특정 테스트만 실행
pnpm test bulk-import.test.ts

# 타입 검사
pnpm tsc --noEmit
```

---

## 📞 Codex 첫 작업 지시문

### 1단계: 환경 설정 (1시간)

1. 저장소 클론
2. 의존성 설치 (`pnpm install`)
3. 환경변수 설정 (`.env.local`)
4. 데이터베이스 마이그레이션 (`pnpm drizzle-kit migrate`)
5. 개발 서버 실행 (`pnpm dev`)

### 2단계: 기능 검증 (2시간)

1. 로그인 테스트 (OAuth)
2. 고객 목록 조회
3. 고객 일괄 등록 (`/customers/bulk-import`)
   - 샘플 CSV 다운로드
   - 파일 업로드 및 검증
   - 데이터 등록
4. 기존 기능 회귀 테스트

### 3단계: XLSX 지원 추가 (4시간)

1. `xlsx` 패키지 설치
2. `client/src/pages/CustomerBulkImport.tsx` 수정
   - XLSX 파일 파싱 추가
   - 파일 타입 감지 (CSV vs XLSX)
3. 테스트 케이스 추가
4. 샘플 XLSX 파일 생성

### 4단계: 오류 행 다운로드 기능 (2시간)

1. `server/routers.ts`에 `customers.downloadFailedRows` 라우터 추가
2. `client/src/pages/CustomerBulkImport.tsx`에 다운로드 버튼 추가
3. 테스트 작성

### 5단계: 배치 이력 조회 페이지 (4시간)

1. 새 페이지 `client/src/pages/BulkImportHistory.tsx` 생성
2. `server/routers.ts`에 `customers.getBulkImportHistory` 라우터 추가
3. DashboardLayout에 메뉴 추가
4. 필터 및 페이지네이션 구현

---

## 📚 참고 자료

- **Drizzle ORM**: https://orm.drizzle.team/
- **tRPC**: https://trpc.io/
- **React**: https://react.dev/
- **Tailwind CSS**: https://tailwindcss.com/
- **shadcn/ui**: https://ui.shadcn.com/

---

## 📞 연락처

**프로젝트 저장소**: https://github.com/raonisi/boa

---

**작성일**: 2026-05-11  
**버전**: 10.0  
**상태**: 인수인계 준비 완료
