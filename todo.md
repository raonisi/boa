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
- [ ] 고객 목록 다중 필터 (지역·유입경로·담당자·배정일)
- [ ] 모바일 캘린더 최적화 (오늘/이번주 뷰)
- [x] 팀장 로그 조회 (팀 범위 필터링)
- [ ] 데이터 다운로드 (관리자 전용 CSV)
- [ ] 설정 화면 (Settings.tsx)
