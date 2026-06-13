# BOA CRM Full System Independent UI/UX Audit

작성일: 2026-06-13  
대상 저장소: `https://github.com/raonisi/boa.git`  
로컬 경로: `C:\work\boa`  
브랜치: `main`  
작업 유형: read-only UI/UX 감사 보고서

## 1. 감사 전제

이번 감사는 BOA CRM 전체 화면의 UI/UX 품질을 독립적으로 점검하기 위한 것이다. 기능 구현, 코드 수정, DB/API/RBAC 변경, migration 실행, 배포, APK 빌드, commit, push, PR 생성은 수행하지 않았다.

감사 관점은 다음 기준을 사용했다.

- 내부 보험 영업 CRM으로서 업무 목적이 3-5초 안에 이해되는가
- 지점장, 부지점장, 팀장, 설계사가 각자 다음 행동을 빠르게 찾을 수 있는가
- 고객 DB, 상담, 후속관리, 계약, 일정, 알림, 운영 리스크 흐름이 끊기지 않는가
- PC와 모바일 모두에서 정보 밀도와 터치 사용성이 적절한가
- Empty, Loading, Error, Forbidden 상태가 구분되는가
- 고객 데이터, 다운로드, 로그, push 관련 UI가 안전한 방향으로 설계되어 있는가

## 2. 확인 범위

### Web PC / Responsive

주요 확인 파일:

- `client/src/App.tsx`
- `client/src/components/DashboardLayout.tsx`
- `client/src/components/MobileNav.tsx`
- `client/src/components/ui/empty-state.tsx`
- `client/src/index.css`
- `client/src/pages/Dashboard.tsx`
- `client/src/pages/CustomerList.tsx`
- `client/src/pages/CustomerDetail.tsx`
- `client/src/pages/ContractList.tsx`
- `client/src/pages/Calendar.tsx`
- `client/src/pages/ActivityLog.tsx`
- `client/src/pages/OperationRiskCenter.tsx`
- `client/src/pages/Download.tsx`
- `client/src/pages/PushNotificationOperations.tsx`

### Flutter Mobile

주요 확인 파일:

- `apps/boa/lib/core/router/app_router.dart`
- `apps/boa/lib/features/shell/boa_shell_screen.dart`
- `apps/boa/lib/features/home/home_tab.dart`
- `apps/boa/lib/features/customers/customers_tab.dart`
- `apps/boa/lib/core/widgets/boa_async_states.dart`
- `apps/boa/lib/core/widgets/boa_ui.dart`

## 3. 전체 평가

종합 점수: 82 / 100

BOA CRM은 이미 단순 관리자 페이지가 아니라 보험 영업 운영 화면에 가까운 구조를 갖추고 있다. 고객 목록, 고객 상세, 후속관리, 상담 기록, 계약 등록, 일정, 운영 리스크, 다운로드 안전 장치 등 핵심 업무 흐름은 상당히 구체적이다.

다만 프리미엄 SaaS와 금융 CRM 기준으로 보면 가장 큰 약점은 정보 구조다. 기능은 많지만, 지점장/팀장/설계사가 오늘 해야 할 일을 우선순위대로 발견하도록 안내하는 구조는 아직 더 다듬어야 한다. 특히 모바일의 더보기 메뉴와 PC 사이드바는 화면 수가 많아질수록 업무 목적보다 라우트 목록처럼 보일 위험이 있다.

## 4. 주요 강점

### 4.1 고객 실행 화면 품질

`CustomerList`와 `CustomerDetail`은 전체 시스템에서 가장 완성도가 높다.

- 고객 목록에 모바일 카드 뷰가 별도로 존재한다.
- 상담 상태, 우선순위, 다음 액션, 담당자, 예상보험료 등 보험 영업에 필요한 정보가 한 화면에 모인다.
- 고객 상세에는 실행 점수, Next Best Action, 빠른 상담, 상담 기록, 후속관리, 계약 등록, 전화, 메시지 문구 액션이 연결되어 있다.
- 고객 상세의 전화번호와 생년월일은 authorized operational work screen 기준에서 업무상 필요한 노출로 볼 수 있다.

### 4.2 Empty / Loading / Error 상태 기반

공통 `EmptyState`, `ErrorState`, `ForbiddenInlineState`가 존재하고, 고객/계약/로그/운영 리스크 화면에서 반복적으로 사용된다. 이는 BOA CRM이 단순 테이블 중심 화면에서 벗어나 운영자가 현재 상태를 이해하도록 돕는 좋은 기반이다.

### 4.3 안전 민감 화면의 방향성

다운로드 화면은 기본값을 마스킹 다운로드로 두고, 사유 입력과 최종 확인을 요구한다. 활동 로그와 운영 리스크 화면은 redaction 유틸을 사용한다. Push 운영 화면도 device token 원문과 고객 민감정보를 노출하지 않는 방향을 화면 문구로 명시한다.

### 4.4 모바일 Flutter 구조

Flutter 앱은 splash, login, shell, bottom navigation, drawer, WebView fallback 구조가 명확하다. Home, Customers, Contracts, Calendar, Notifications를 하단 탭에 배치한 것은 모바일 현장 업무 기준으로 합리적이다.

## 5. 주요 문제점

### P2. 모바일 더보기 메뉴가 너무 길고 업무 우선순위가 약하다

위치:

- `client/src/components/MobileNav.tsx`
- `apps/boa/lib/features/shell/boa_shell_screen.dart`

모바일 Web과 Flutter 모두 핵심 하단 탭은 좋지만, 더보기/Drawer에 들어가는 화면 수가 많다. 지점장이나 팀장은 운영 리스크, DB 배정, 조직, 활동 로그, 다운로드, 사용자 관리, 알림 운영 등 여러 화면을 사용해야 하는데 현재 구조는 업무 묶음보다 라우트 목록에 가깝다.

부족한 점:

- 오늘 조치해야 할 관리자 업무와 설정성 메뉴가 같은 레벨에 있다.
- 위험/긴급/미처리 업무가 더보기 안에서 먼저 보이지 않는다.
- 모바일에서 긴 목록을 스캔해야 하므로 반복 사용 피로도가 높다.

개선 방향:

- 더보기 메뉴를 `오늘 처리`, `고객/계약`, `팀/조직`, `운영 리스크`, `설정/관리`처럼 업무 목적별로 재그룹화한다.
- 관리자 권한에서는 운영 리스크, DB 배정, 팀 현황처럼 매일 보는 항목을 상단에 고정한다.
- 위험 카운트, 미처리 알림 수, SLA 지연 수 같은 작은 배지를 더보기 항목에 붙인다.

### P2. PC 사이드바가 기능 목록 중심이라 역할별 업무 흐름이 약하다

위치:

- `client/src/components/DashboardLayout.tsx`

사이드바는 RBAC 필터링이 잘 적용되어 있으나, 메뉴가 많아질수록 “내가 지금 무엇을 해야 하는가”보다 “어떤 화면으로 이동할 수 있는가”가 먼저 보인다.

부족한 점:

- 지점장, 부지점장, 팀장, 설계사의 실제 업무 리듬이 메뉴 우선순위에 충분히 반영되지 않는다.
- 운영 리스크, 활동 로그, 관리자 보고서, 팀 관리, DB 배정이 모두 관리자 그룹 안에 들어가 있어 위험도/빈도 차이가 약하다.
- 신규 사용자는 화면 목적을 메뉴명만으로 추론해야 한다.

개선 방향:

- 역할별 첫 5개 메뉴를 실제 일일 업무 순서로 조정한다.
- 관리자 메뉴 안에서도 `오늘 조치`, `팀 운영`, `보안/감사`, `설정`을 분리한다.
- 메뉴명은 개발/관리 코드 느낌보다 현장 업무 표현으로 통일한다.

### P2. Dashboard 핵심 지표의 로딩/오류 구분이 약하다

위치:

- `client/src/pages/Dashboard.tsx`

Dashboard는 TodayWorkSection, KPI 카드, 목표 요약, 업무 리듬 카드로 구성되어 방향은 좋다. 하지만 일부 지표 쿼리가 실패하거나 아직 로딩 중일 때 `0`, `-`, 기존 값처럼 보일 수 있다.

부족한 점:

- 성과/고객 수 카드에서 데이터 실패와 실제 0건의 차이가 명확하지 않다.
- retry action이 대시보드 상단에서 바로 보이지 않는다.
- 지점장 화면의 전체 DB와 내 DB 비교는 좋지만, 다음 조치로 이어지는 CTA가 더 강해질 수 있다.

개선 방향:

- KPI 카드에 loading skeleton, error badge, retry affordance를 명확히 둔다.
- “미상담”, “SLA 지연”, “다음 액션 없음” 같은 조치형 지표를 대시보드 상단에서 더 강하게 노출한다.
- 숫자 카드 클릭 시 해당 필터가 적용된 고객 목록으로 이동하게 한다.

### P2. 관리자/운영 리스크 화면은 강력하지만 초보 운영자에게 무겁다

위치:

- `client/src/pages/OperationRiskCenter.tsx`
- `client/src/pages/ActivityLog.tsx`
- `client/src/pages/Download.tsx`
- `client/src/pages/PushNotificationOperations.tsx`

운영 리스크와 활동 로그는 안전성과 감사 목적에는 잘 맞는다. 다만 화면 정보량이 많아 “지금 당장 무엇을 확인해야 하는가”가 약해질 수 있다.

부족한 점:

- 운영 리스크 summary, actions, logs, status 탭이 많고, 각 탭 내부 정보도 밀도가 높다.
- 활동 로그 필터는 충분하지만, 위험 작업을 먼저 처리하는 관점의 안내가 더 필요하다.
- 다운로드 화면은 안전 확인은 좋지만, 실행 버튼이 비활성화된 이유를 단계별로 더 명확히 보여줄 수 있다.

개선 방향:

- 운영 리스크 첫 화면에 `오늘 확인 필요`, `최근 고위험`, `다운로드`, `권한/삭제`, `push`를 우선순위 큐처럼 보여준다.
- 활동 로그는 위험 작업만 먼저 보는 빠른 필터를 상단 CTA로 승격한다.
- 다운로드 모달은 미충족 조건 체크리스트를 버튼 근처에 표시한다.

### P3. 고객 상세는 강력하지만 모바일에서는 정보량이 많다

위치:

- `client/src/pages/CustomerDetail.tsx`

고객 상세는 BOA CRM의 핵심 화면답게 많은 업무를 지원한다. 하지만 모바일에서는 실행 요약, 고객 정보, Next Best Action, 액션 패널, 관리 요약, 태그, 탭 콘텐츠가 길게 이어져 사용자가 반복적으로 스크롤해야 한다.

개선 방향:

- 모바일 상단에는 `전화`, `상담 기록`, `후속관리`, `계약 등록`만 고정하고 나머지는 접이식 섹션으로 정리한다.
- `Next Best Action`과 `고객 실행 패널`의 역할이 겹치지 않게 하나는 판단, 하나는 실행으로 시각적으로 분리한다.
- 상담 태그는 전체 노출보다 선택된 태그 우선 + 더보기 구조가 적합하다.

### P3. 계약 목록은 업무 정보가 좋지만 모바일 CTA가 약하다

위치:

- `client/src/pages/ContractList.tsx`

계약 목록은 모바일 카드와 테이블을 모두 제공한다. 상품명, 보험사, 월납보험료, 결제상태, 계약상태는 잘 보인다.

부족한 점:

- 모바일 카드에서 다음 행동이 주로 상세 이동/삭제 요청에 머문다.
- 계약 이슈가 있는 경우, 미납/실효/철회 등 상태별 우선 조치 CTA가 더 명확하면 좋다.

개선 방향:

- 미납/실효 상태에는 상담/일정 등록 CTA를 카드 안에 직접 노출한다.
- 계약 카드에 고객명과 연락 액션을 더 명확히 연결한다.

## 6. 디자인 시스템 평가

### 색상

현재 색상 토큰은 navy, white, soft gray, deep green, amber, restrained red 방향으로 잘 잡혀 있다. 보험/금융 CRM에 어울리는 차분한 색감이다.

주의할 점:

- 일부 화면에서 amber/green/red 강조가 많아지면 우선순위가 흐려진다.
- 위험/주의/성공/정보 색상 사용 규칙을 더 엄격히 문서화하면 좋다.

### Typography

전체적으로 Pretendard 계열과 tabular number 설정은 적절하다. 다만 일부 카드 안의 제목과 설명이 많아져 화면 전체가 “작은 글씨가 많은 대시보드”처럼 느껴질 수 있다.

개선 방향:

- 운영 화면의 제목은 유지하되, 카드 내부 설명문은 더 짧게 줄인다.
- 긴 한글 레이블은 버튼 안에서 줄바꿈/축약 규칙을 통일한다.

### Spacing / Radius / Shadow

카드 반경과 그림자는 대부분 과하지 않다. 다만 카드가 연속되는 화면에서는 카드 안 카드처럼 보이는 구간이 있어 정보 계층이 복잡해질 수 있다.

개선 방향:

- 반복 목록은 카드보다 행/섹션 구분을 적극 사용한다.
- 요약 카드와 입력/필터 카드를 시각적으로 더 구분한다.

### Tables

PC 테이블은 운영 밀도 측면에서 적절하다. 모바일에서는 별도 카드 뷰가 있는 화면이 많아 긍정적이다.

개선 방향:

- 모든 테이블형 화면에서 모바일 카드 대체 뷰가 있는지 표준화한다.
- 가로 스크롤이 필요한 화면은 스크롤 힌트를 명확히 둔다.

### Empty / Loading / Error / Forbidden

공통 상태 컴포넌트가 있고 여러 화면에서 사용된다. 이는 좋은 품질 신호다.

개선 방향:

- Error 상태에는 가능한 경우 `다시 시도` 외에 `권한 문제일 수 있음`, `필터 초기화` 같은 맥락별 복구 CTA를 둔다.
- Forbidden은 깨진 화면이 아니라 권한 범위 안내로 유지한다.

## 7. 역할별 UX 평가

### branch_admin / 지점장

강점:

- 전체 DB, 내 DB, 다운로드, 사용자/팀/조직, 운영 리스크, 삭제 데이터 관리 등 권한 화면이 충분하다.
- 다운로드/로그/운영 리스크에서 안전 장치가 보인다.

부족한 점:

- 지점장에게 매일 필요한 `위험`, `미처리`, `다운로드/삭제`, `팀 운영` 우선순위가 메뉴에서 명확히 드러나지 않는다.

### sub_branch_admin / 부지점장

강점:

- 고객, 조직, 팀 인사이트, 운영 리스크 일부 흐름을 볼 수 있다.

부족한 점:

- 본인 권한에서 어디까지 조치 가능한지 화면마다 더 명확한 안내가 있으면 좋다.

### team_leader / 팀장

강점:

- 팀 고객 관리, 팀 인사이트, SLA, 팀 처리율/코칭 흐름이 존재한다.

부족한 점:

- 팀장이 매일 보는 “팀원별 오늘 지연/미상담/다음 액션 없음” 흐름이 첫 화면에서 더 강하게 보여야 한다.

### member / 설계사

강점:

- 고객, 일정, 알림, 상담/후속관리 중심 구조는 적합하다.
- 모바일 하단 탭이 현장 사용에 맞다.

부족한 점:

- 다음 고객, 다음 연락, 미처리 상담, 오늘 일정이 더 압축적으로 연결되면 반복 업무 속도가 올라간다.

## 8. 화면별 요약 평가

| 영역 | 평가 | 점수 |
| --- | --- | --- |
| Login / Auth | 브랜드형 로그인과 guard 구조가 있음. 문구/오류 상태 polish 필요 | 80 |
| Dashboard | 오늘 업무 방향은 좋음. KPI 로딩/오류와 조치 CTA 보강 필요 | 82 |
| Customer List | 모바일 카드, 필터, 상태, 액션이 좋음 | 88 |
| Customer Detail | 핵심 업무 집약도가 높음. 모바일 정보량 조절 필요 | 86 |
| Contract List | 상태/금액/상품 정보가 명확함. 상태별 CTA 보강 필요 | 81 |
| Calendar | 모바일 일정 범위와 dialog viewport 대응이 보임. 일정 우선순위 표현 강화 필요 | 82 |
| Notifications | 알림 센터와 unread badge 흐름이 있음. 우선순위/묶음 polish 필요 | 80 |
| Activity Log | 마스킹과 모바일 카드가 있음. 위험 작업 우선 큐 강화 필요 | 84 |
| Operation Risk | 안전 관점이 강함. 초보 관리자용 액션 가이드 보강 필요 | 84 |
| Download | 안전 확인 UX가 좋음. 비활성 조건 안내 개선 필요 | 86 |
| PC Navigation | RBAC 필터링은 좋음. 업무 우선순위 재구성 필요 | 78 |
| Mobile Navigation | 하단 탭은 좋음. 더보기 메뉴 과밀 | 76 |
| Flutter Mobile | shell 구조가 명확함. Drawer 정보 구조 개선 필요 | 80 |

## 9. 우선 개선안

### 1순위: 역할별 메뉴 재정렬

제품 기능 추가 없이 가능한 UI/UX 개선이다. PC sidebar와 mobile more/drawer를 역할별 업무 순서로 재배치한다.

권장 구조:

- 설계사: 오늘 업무, 고객, 일정, 알림, 계약, 후속관리
- 팀장: 오늘 팀 리스크, 고객, DB 품질, 팀 인사이트, SLA, 일정
- 부지점장: 팀/조직 운영, DB 배정, 운영 리스크, 활동 로그, 보고서
- 지점장: 운영 리스크, 다운로드/삭제, 사용자/팀/조직, 보고서, 설정

### 2순위: Dashboard를 조치형으로 강화

숫자 카드보다 다음 행동을 먼저 보여준다.

권장 카드:

- 오늘 연락 필요
- SLA 지연
- 다음 액션 없음
- 미상담 신규 DB
- 위험 로그/다운로드 확인 필요

각 카드는 클릭 시 필터가 적용된 목록으로 이동해야 한다.

### 3순위: 관리자 화면의 위험 큐 추가

운영 리스크와 활동 로그는 이미 데이터와 구조가 있다. 첫 화면에서 “오늘 처리할 위험 항목”을 큐 형태로 보여주면 관리자의 의사결정 속도가 오른다.

### 4순위: 모바일 고객 상세 압축

모바일 고객 상세 상단은 실행 중심으로 줄인다.

- 전화
- 상담 기록
- 후속관리
- 계약 등록
- 메시지 문구

나머지 상세 정보는 접이식 섹션 또는 탭 내부로 보낸다.

### 5순위: 상태별 CTA 표준화

고객, 계약, 일정, 알림의 상태 badge는 존재하지만, 상태에 따른 다음 행동이 항상 명확하지는 않다.

예:

- 미상담: 전화 / 상담 기록
- SLA 지연: 즉시 연락 / 일정 등록
- 미납: 고객 연락 / 후속관리 등록
- 위험 로그: 상세 보기 / 조치 완료 기록

## 10. 금지 범위 준수 확인

이번 감사에서 수행하지 않은 것:

- 제품 코드 수정
- DB 변경
- API 변경
- RBAC 변경
- migration 실행
- 운영 배포
- APK/AAB 빌드
- git add
- commit
- push
- PR 생성
- 실제 고객 데이터 사용
- secret/env/device token/google-services.json 원문 출력

이번 보고서 작성으로 추가된 파일:

- `docs/BOA_CRM_FULL_SYSTEM_UI_UX_AUDIT.md`

## 11. 검증 기록

실행한 확인:

- 저장소 원격: `https://github.com/raonisi/boa.git`
- 브랜치: `main`
- `.codegraph/config.json` 존재 확인
- 주요 web route, layout, mobile nav, customer, contract, calendar, activity log, operation risk, download 화면 구조 확인
- Flutter app router, shell, bottom navigation, drawer, home/customer tab 구조 확인
- 보안 추적 파일 검색 일부 수행

명령 결과:

- `pnpm.cmd check`는 약 124초 후 timeout으로 완료 결과를 얻지 못했다.
- 보안 추적 파일 검색은 timeout 전 반환 결과에서 `.env.example`, docs, build script, `server/_core/env.ts`만 확인되었다. 실제 secret 파일 원문은 출력하지 않았다.
- 작업 시작 전부터 working tree에 대규모 변경이 있었다. 이 보고서는 해당 기존 변경을 되돌리거나 정리하지 않는다.

## 12. 결론

BOA CRM의 UI/UX는 이미 보험 영업 CRM의 핵심 업무를 많이 반영하고 있다. 특히 고객 실행, 모바일 고객 카드, 후속관리, 안전한 다운로드, 활동 로그/운영 리스크는 좋은 기반이다.

다음 단계는 기능 추가가 아니라 정보 구조 정리다. 역할별로 “오늘 해야 할 일”이 먼저 보이도록 PC sidebar, 모바일 더보기, dashboard, 운영 리스크 첫 화면을 재정렬하면 제품 체감 품질은 크게 올라갈 수 있다.
