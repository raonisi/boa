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
