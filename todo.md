# Insurance CRM Todo

## DB Schema & Migration
- [x] 확장된 users 테이블 (role: admin/manager/agent/inactive, team_id)
- [x] teams 테이블
- [x] customers 테이블 (고객 DB 전체 항목)
- [x] consultations 테이블 (상담기록)
- [x] contracts 테이블 (계약관리)
- [x] schedules 테이블 (일정)
- [x] notifications 테이블 (알림)
- [x] activity_logs 테이블 (활동로그)

## Backend Routers
- [x] auth 라우터 (me, logout, role 확인)
- [x] users 라우터 (목록, 권한변경, 팀변경, 차단)
- [x] customers 라우터 (CRUD, 배정, 상태변경)
- [x] consultations 라우터 (CRUD)
- [x] contracts 라우터 (CRUD)
- [x] schedules 라우터 (CRUD, 권한별 조회)
- [x] notifications 라우터 (목록, 읽음처리, 생성)
- [x] performance 라우터 (실적 집계)
- [x] logs 라우터 (활동로그 조회)

## Frontend Pages
- [x] 공통 DashboardLayout (사이드바, 상단바, 알림 아이콘)
- [x] 로그인 / 접근 차단 페이지
- [x] 대시보드 (관리자/팀장/팀원 권한별 조회)
- [x] 고객 DB 목록 화면
- [x] DB 배정 화면 (관리자)
- [x] 고객 상세 화면 (기본정보/상담기록/계약정보 탭)
- [x] 계약관리 화면
- [x] 실적관리 화면 (차트 포함)
- [x] 알림센터
- [x] 내부 캘린더 (월/주/일 뷰)
- [x] 사용자 관리 화면 (관리자)
- [x] 활동 로그 화면 (관리자)

## Tests
- [x] RBAC 권한 테스트 (admin/manager/agent/inactive)
- [x] auth.logout 테스트
- [x] 전체 12개 테스트 통과

## 2차 고도화 작업

### DB 스키마 확장
- [x] customers 테이블: is_active, deleted_at, assigned_team_id 컬럼 추가
- [x] contracts 테이블: is_active, deleted_at, owner_user_id 컬럼 추가
- [x] schedules 테이블: is_active, deleted_at, description, team_id, completed_at, reminder 플래그 컬럼 추가
- [x] consultations 테이블: is_active, deleted_at 컬럼 추가
- [x] status_history 테이블 신규 생성 (고객 상담상태 변경 이력)
- [x] consent_logs 테이블 신규 생성 (동의 이력)
- [x] reminders 테이블 신규 생성 (알림 due_at, 중복 방지 unique 키)

### 알림 자동 생성 로직
- [x] 계약 등록 시 90/180/365일 알림 자동 생성 (중복 방지)
- [x] 고객 배정 시 생일 알림 자동 생성
- [x] 배정 후 3일 미상담 알림 (서버 로직)
- [x] 상담기록 next_follow_up_at 입력 시 재상담 알림 생성
- [x] 납입상태 미납/실효/해지 변경 시 알림 생성
- [x] 일정 등록 시 하루 전/당일/1시간 전 알림 생성 (reminder 플래그 기반)

### 활동 로그 강화
- [x] 고객 조회 로그 기록
- [x] 담당자 변경 로그 기록
- [x] 상담기록 수정 로그
- [x] 일정 취소/완료 로그
- [x] 퇴사자 차단 로그

### 고객 상세 화면 개선
- [x] 상태 변경 이력 탭 추가 (status_history)
- [x] 동의 이력 표시 (consent_logs)
- [x] 담당자 변경 기능 (관리자/팀장)
- [x] soft delete 처리 (고객 비활성화)

### 모바일 UI 개선
- [x] 고객 목록 모바일 카드 뷰
- [x] 빠른 상담상태 변경 버튼 (모바일)
- [x] 하단 네비게이션 바 (모바일)
- [x] 전화 연결 버튼 강조

## 3차 수정 작업 (검수 보고서 기반)

### 1단계: 치명적 문제
- [x] 고객 기본정보 수정 UI (CustomerDetail 기본정보 탭 수정 버튼+모달)
- [x] 상담기록 수정 기능 (consultations.update 라우터 + UI)
- [x] 로그인 활동 로그 (oauth.ts USER_LOGIN 기록)
- [x] 장기 미관리 90일 알림 (상담 작성 시 기존 알림 processStatus=처리완료 후 재예약)

### 2단계: 높은 우선순위
- [x] 연락처 중복 확인 (등록 시 phone 중복 체크)
- [x] 배정 이력 테이블 (assignment_history 신규 + 배정/변경 시 기록)
- [x] 알림 처리상태 4단계 (processStatus 컨럼 + 알림센터 UI)
- [x] 미완료 일정 알림 (endTime 기준 예약 + 완료/취소/노쇼 시 알림 취소)
- [x] 실적 기간·팀·팀원 필터 (Performance.tsx 필터 추가)
- [x] 계약 변경 이력 (contract_history 테이블 + 수정 시 필드별 before/after)
- [x] 팀 관리 전용 화면 (TeamManagement.tsx)
- [x] 서버 레벨 권한 보강 (개별 API 소유권 검증 강화)

### 3단계: 중간 우선순위
- [x] 고객 목록 다중 필터 (지역·유입경로·담당자 필터)
- [x] 모바일 캘린더 최적화 (오늘/이번주 뷰)
- [x] 팀장 로그 조회 (팀 범위 필터링)
- [ ] 데이터 다운로드 (관리자 전용 CSV) - 향후 구현 예정
- [ ] 설정 화면 (Settings.tsx) - 향후 구현 예정

## 4차 수정 작업 (권한 구조 재정의)

### 1단계: 치명적 문제 3건
- [x] consultations.list 권한 검증 (customerId → 고객 소유권 검증)
- [x] contracts.listByCustomer 권한 검증 (동일 방식)
- [x] 퇴사자 서버 레벨 로그인 차단 (oauth.ts role=inactive 체크 + LOGIN_BLOCKED 로그)

### 2단계: DB 스키마 재정의
- [ ] users.role enum 변경 (branch_admin/sub_branch_admin/team_leader/member)
- [ ] users.accountStatus 컬럼 추가 (active/inactive/resigned)
- [ ] users.subBranchAdminId 컬럼 추가
- [ ] teams 테이블 확장 (description, isActive, subBranchAdminId)
- [ ] customers.subBranchAdminId, assignmentStatus 컬럼 추가
- [ ] assignment_history 테이블 확장 (배분 이력 컬럼)

### 3단계: 서버 미들웨어 및 라우터 재정의
- [ ] 5단계 권한 미들웨어 (branchAdminProcedure, subBranchAdminProcedure 등)
- [ ] 모든 라우터 권한 로직 업데이트
- [ ] DB 배정 라우터 재작성 (지점장 전체, 부지점장 제한)

### 4단계: 높은 우선순위
- [ ] 실적 기간 필터 DB 쿼리 적용
- [ ] schedules.update 권한 수정
- [ ] consultations.update 범위 검증
- [ ] CustomerDetail 배정 이력 탭
- [ ] 계약 비활성 처리
- [ ] CONTRACT_OWNER_CHANGED 로그
- [ ] 데이터 다운로드 (지점장 전용)

### 5단계: 팀 관리 보완 + 중간 우선순위
- [ ] 팀명 수정·비활성화·팀장 변경
- [ ] 고객 목록 배정일 필터
- [ ] 모바일 미완료 일정 섹션
- [ ] 설정 화면 (지점장 전용)
- [ ] 실적 상품군·보험사·지역·유입경로 필터

## 5차 수정 작업 (v3 검수 기반)

### 치명적 문제 4건
- [x] 지점장→부지점장 DB 배분 UI (CustomerAssign.tsx 탭 추가)
- [x] 부지점장 전용 DB 배정 UI (/customers/assign SubBranchAdminOrAboveGuard)
- [x] CustomerDetail 배정 이력 탭 추가
- [x] 부지점장 전용 대시보드 분기 (Dashboard.tsx)

### 높은 우선순위 7건
- [x] 데이터 다운로드 (Download.tsx + branchAdminProcedure + DATA_DOWNLOAD 로그)
- [x] 설정 화면 (Settings.tsx + DB 저장 구조 + settings 테이블)
- [x] 실적 필터 확장 (상품군·보험사·지역·유입경로 UI + DB 쿼리)
- [x] 계약 비활성 처리 UI (ContractList.tsx 비활성 버튼 + 확인 모달)
- [x] DB 배정 로그 분리 (DB_ASSIGNED_BY_BRANCH_ADMIN, DB_ASSIGNED_BY_SUB_BRANCH_ADMIN, ASSIGNMENT_HISTORY_CREATED)
- [x] 모바일 미완료 일정 섹션 (Calendar.tsx 모바일 뷰)
- [x] 고객 목록 배정일 날짜 범위 필터 (CustomerList.tsx + DB 쿼리)

## 6차 수정 작업 (v4 검수 기반)

### 치명 문제 2건
- [x] TeamManagement 계층 구조 추가 (부지점장→팀→팀장→팀원 + 미배정 섹션)
- [x] 지점장 조직 배치 UI (팀장·팀원을 부지점장 산하로 배치/이동)

### 높은 우선순위 6건
- [x] UserManagement subBranchAdminId 배치 UI (팀장·팀원만 대상, 팀 불일치 시 팀 해제 후 처리)
- [x] Settings 항목 수정(edit) 기능 + settings.update 라우터 + DB 기반
- [x] 실적 월 선택 필터 (Performance.tsx type="month" + dateFrom/dateTo 자동 변환)
- [x] 로그 보완 (CUSTOMER_REASSIGNED, USER_MOVED_TO_ANOTHER_SUB_BRANCH, USER_MOVED_TO_ANOTHER_TEAM, MEMBER_ASSIGNED_TO_TEAM)
- [x] 부지점장 전용 화면 권한 범위 문구 추가 (고객관리, 계약관리 상단)
- [x] 불일치 방지 (팀 이동 시 users.subBranchAdminId 자동 동기화, 부지점장 변경 시 팀 해제 후 처리)

## 7차 수정 작업 (v5 검수 기반)

### 사전 점검
- [x] 기존 데이터 불일치 점검 (사용자 1명, 불일치 없음)

### 치명 문제 1건
- [x] 부지점장 알림센터 권한 범위 수정 (산하 팀원 알림 포함 + 팀장 팀원 포함)

### 높은 우선순위 3건
- [x] USER_MOVED_TO_ANOTHER_SUB_BRANCH 로그 before 값 버그 수정 (수정 전 먼저 조회 + 서버 레벨 불일치 차단 추가)
- [x] CUSTOMER_TRANSFERRED 로그 추가 (assignToSubBranch 시 before/after 포함)
- [x] 서버 레벨 불일치 저장 차단 (users.updateSubBranchAdmin BAD_REQUEST)

### 신규 사용자 추가 기능
- [x] users 테이블에 사전 등록 + OAuth 이메일 매핑 (invited_ 프리픽스 openId 방식)
- [x] UserManagement 사용자 추가 버튼 + 모달 (이름/이메일/역할/팀/부지점장 입력)
- [x] users.create 라우터 (branchAdminProcedure + 이메일 중복 검증 + 조직 정합성 검증)
- [x] loginStatus 컨럼 추가 (invited/linked)
- [x] 이메일 중복 검증
- [x] USER_CREATED 로그

## 8차 수정 작업 (v6 검수 기반)

### 치명 문제 1건
- [x] 지점장 알림센터 전체 알림 조회 (getAllNotifications limit 500 + 기존 필터 유지)

### 높은 우선순위 3건
- [x] updateTeam 로그 보강 (before/after 구조, 부지점장 변경 시 USER_MOVED_TO_ANOTHER_SUB_BRANCH 자동 추가)
- [x] users 테이블 phone/memo 컨럼 추가 + users.create 라우터 확장 + CreateUserModal 연락처·메모 추가 + 민감정보 안내 문구
- [x] 이메일 중복 처리 보강 (getAllUsersByEmail, OAuth 매핑 2개 이상 차단 + USER_OAUTH_LINK_CONFLICT 로그, unique constraint 적용 완료)
