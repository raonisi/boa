# BOA CRM Flutter Native Field Coverage Matrix

Official coverage matrix for the BOA CRM **pilot field mobile app** (`apps/boa`). Use this document with [MOBILE_APP_ARCHITECTURE.md](./MOBILE_APP_ARCHITECTURE.md) and [PILOT_READINESS_RECHECKLIST.md](./PILOT_READINESS_RECHECKLIST.md).

## A. Final Principle

**BOA CRM 모바일 앱의 공식 방향은 일상 업무 80%를 Flutter Native로 처리하고, 관리자·고위험·대량 작업은 WebView 또는 PC Web 중심으로 유지하는 것이다.**

| Layer | Role |
| --- | --- |
| **Flutter (`apps/boa`)** | 현장 설계사용 **실행 앱** — 조회·입력·완료·알림 |
| **WebView (in-app)** | 모바일에서 꼭 필요한 **관리자·고위험** 화면 fallback |
| **PC Web (`client/`)** | 지점장·관리자용 **운영 콘솔** — 대량·감사·설정 |
| **Capacitor (`android/app`, `capacitor.config.ts`)** | **Legacy fallback** — 즉시 삭제하지 않음 |

## B. Role Separation

### Flutter Native

- 현장 설계사가 **매일** 사용하는 실행 업무
- 빠른 조회, 입력, 저장, 완료, 연기, 알림 확인
- 모바일에서 **손으로 즉시** 처리해야 하는 업무
- 푸시 알림과 연결된 업무 흐름

### WebView / PC Web

- 지점장·관리자 **운영** 업무
- **대량** 처리 (일괄 등록, 배정, 담당자 변경)
- **고위험·복구 어려운** 변경 (삭제, 병합, permanent delete)
- **감사·로그** 중심 업무 (ActivityLog, OperationRisk, push operations)
- **넓은 화면**에서 검수해야 안전한 분석·파이프라인
- CSV/XLSX 업로드 및 파일 기반 작업

## C. Flutter Native 80% Target Features

Status legend:

| Status | Meaning |
| --- | --- |
| **Native 완료** | Flutter Native로 현장 사용 가능 |
| **Native 고도화 필요** | Native 있으나 UX·안정성·완성도 보강 필요 |
| **Native 전환 예정** | 아직 Web/WebView 중심, Native 이전 계획 |
| **WebView 유지** | 의도적으로 WebView/PC만 |
| **보류** | 파일럿 이후 우선순위 재평가 |

| # | 기능 | 현재 상태 | 목표 상태 | 우선순위 | 구현 방식 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 로그인 | Native 완료 | Native 완료 | P0 | `SignInScreen` + Google OAuth + secure session | |
| 2 | 홈 대시보드 | Native 완료 | Native 고도화 필요 | P0 | `HomeTab` + `dashboardTodayWorkProvider` | KPI·오늘 할 일 hierarchy polish |
| 3 | 오늘 할 일 | Native 완료 | Native 완료 | P0 | `FieldCommandCenterView` (`HomeTab`) | 후속 Quick Action·일정 완료·알림 요약 |
| 4 | 고객 목록 | Native 완료 | Native 고도화 필요 | P0 | `CustomersTab` + search debounce | Empty/loading polish 적용 |
| 5 | 고객 검색 | Native 완료 | Native 완료 | P0 | `GlobalSearchScreen` + `/api/mobile/customers?search=` | Shell·Field Command Center 전역 진입 |
| 6 | 고객 상세 | Native 완료 | Native 완료 | P0 | `CustomerDetail360View` | 후속·일정·계약·타임라인·빠른 실행 |
| 7 | 상담상태 변경 | WebView fallback | Native 완료 | P1 | `CrmWebScreen` `/customers/:id` | mobile PATCH API 후속 PR |
| 8 | 우선순위 / 태그 / 다음 액션 | WebView fallback | Native 완료 | P1 | Hero 표시 + 웹 수정 | mobile PATCH API 후속 PR |
| 9 | 상담기록 작성 | WebView fallback | Native 완료 | P1 | 빠른 실행 → 웹 고객 상세 | mobile consultation API 후속 PR |
| 10 | 후속관리 생성 | Native 완료 | Native 완료 | P0 | Dialog + `POST .../follow-ups` | |
| 11 | 후속관리 완료 | Native 완료 | Native 완료 | P0 | `FollowUpQuickActionTile` → `POST .../complete` | Field Command Center·CustomerDetail·Calendar 공통 |
| 12 | 후속관리 연기 | Native 완료 | Native 완료 | P0 | `FollowUpQuickActionTile` → `POST .../postpone` | 내일·3일·날짜 직접 선택 |
| 13 | 일정 생성 | Native 완료 | Native 완료 | P0 | `CreateScheduleDialog` / `CreateCustomerScheduleDialog` | Calendar·고객 상세·quick action |
| 14 | 일정 완료 | Native 완료 | Native 완료 | P0 | `ScheduleQuickActionTile` → `POST .../complete` | 확인 다이얼로그 후 완료 |
| 15 | 캘린더 / 일정 조회 | Native 완료 | Native 완료 | P1 | `CalendarTab` 오늘/예정 구분 + agenda provider | |
| 16 | 계약 목록 | Native 완료 | Native 완료 | P0 | `ContractsTab` + `ContractSummaryCard` | 월납 합계·상태 배지 |
| 17 | 신규 계약 등록 | Native 완료 | Native 완료 | P0 | `ContractCreateScreen` | 고객 context·validation·저장 갱신 |
| 18 | 월납보험료 / 계약 요약 | Native 완료 | Native 완료 | P1 | `ContractSummaryCard` | CustomerDetail·Field Command Center 공통 |
| 19 | 알림함 | Native 완료 | Native 완료 | P0 | `NotificationsTab` + `NotificationActionTile` | 유형·상태 badge, 미확인 필터, 업무 화면 연결 |
| 20 | 푸시 알림 설정 | Native 완료 | Native 완료 | P0 | `PushPreferencesScreen` + mobile push-preferences API | 섹션 hierarchy, 조용한 시간대 레이아웃 |
| 21 | 성과 / 목표 / 부족분 | Native 완료 | Native 고도화 필요 | P1 | `PerformanceScreen`, `GoalsScreen` | |
| 22 | 빠른 실행 버튼 | Native 고도화 필요 | Native 완료 | P1 | Shell FAB·상세 액션 버튼 | Command Center PR |
| 23 | 통합 검색 | 보류 | Native 전환 예정 | P2 | — | 향후 예정 |
| 24 | 빠른 고객 등록 | 보류 | Native 전환 예정 | P2 | — | 향후 예정; 일괄 등록은 Web 유지 |

**Coverage note:** Items 1–21 cover daily field workflows. Items 7–9 and 22–24 are the main gap between “pilot ready” and “80% native polish complete.”

## D. WebView / PC Retained Features

| # | 기능 | 유지 방식 | 이유 | 모바일 접근 방식 | 위험도 |
| --- | --- | --- | --- | --- | --- |
| 1 | 고객 일괄 등록 | PC Web (+ WebView) | CSV/XLSX·대량 검증 | Drawer → WebView `/customers/bulk-import` | 높음 |
| 2 | DB 일괄 배정 | PC Web (+ WebView) | scope·담당자 실수 방지 | WebView `/customers/assign` | 높음 |
| 3 | 대량 담당자 변경 | PC Web | 다건 변경·감사 필요 | PC 권장 | 높음 |
| 4 | 사용자 관리 | PC Web (+ WebView) | branch_admin 전용 | WebView `/users` | 높음 |
| 5 | 조직 관리 | PC Web (+ WebView) | 구조 변경·RBAC | WebView `/organization` | 높음 |
| 6 | 팀 관리 | PC Web (+ WebView) | 조직 하위 단위 | WebView `/teams` | 중간 |
| 7 | 인수인계 관리 | PC Web (+ WebView) | 고객·계약 scope 이동 | WebView `/users/handoff` | 높음 |
| 8 | 중복 고객 병합 | PC Web (+ WebView) | irreversible에 가까움 | WebView `/customers/merge` | 높음 |
| 9 | 삭제 데이터 관리 | PC Web (+ WebView) | 복구·감사 | WebView `/deleted-data` | 높음 |
| 10 | permanent delete | PC Web | branch_admin 통제 삭제 | PC only 권장 | 매우 높음 |
| 11 | 관리자 감사 로그 | PC Web (+ WebView) | 대량 로그·필터 | WebView `/logs` | 중간 |
| 12 | ActivityLog | PC Web | 운영 기록 조회 | Web 또는 WebView | 중간 |
| 13 | OperationRisk | PC Web (+ WebView) | 운영 리스크 센터 | WebView `/operation-risk` | 높음 |
| 14 | Push Operations Dashboard | PC Web | branch_admin 발송 로그 | WebView `/push-notifications` | 중간 |
| 15 | 복잡한 영업 분석 | PC Web (+ WebView) | 차트·피벗 | WebView `/analytics` | 낮음 |
| 16 | 세일즈 파이프라인 | WebView 유지 | 칸반·다중 필터 | WebView `/sales-pipeline` | 낮음 |
| 17 | CSV/XLSX 업로드 | PC Web | 파일 처리 | PC 권장 | 높음 |
| 18 | 배포·운영 관련 설정 | PC Web (+ WebView) | 환경·시스템 설정 | WebView `/settings` | 높음 |

## E. Native vs Web Decision Criteria

### Flutter Native 전환 대상

- **매일** 쓰는 업무
- 입력 빈도가 **높은** 업무
- 현장에서 **즉시** 처리해야 하는 업무
- 터치·스크롤·키보드 UX가 **중요한** 업무
- **푸시 알림**과 연결되는 업무
- 고객 상담 **중** 바로 필요한 업무

### Web / PC 유지 대상

- **대량** 작업
- **irreversible** 또는 복구 어려운 작업
- **지점장·관리자 전용** 작업
- **권한·감사 로그**가 중요한 작업
- 화면이 **넓어야 안전한** 작업
- **파일 업로드 / 엑셀** 처리 업무
- source/target **실수 위험**이 큰 작업

## F. Development Roadmap (PR Units)

| PR | 목적 | 주요 화면 | 위험도 | 권장 검수 방식 |
| --- | --- | --- | --- | --- |
| 1. Flutter Field Command Center | 홈·오늘 할 일·빠른 실행 통합 (**완료**) | `HomeTab`, `field_command_center.dart` | 낮음 | `[TEST]` 고객 + role smoke |
| 2. CustomerDetail 360 Native Upgrade | 상담상태·우선순위·상담기록 Native (**완료**, 편집/상담기록은 WebView) | `CustomerDetail360View` | 중간 | scope·RBAC API 검증 |
| 3. Follow-up / Schedule Quick Action Upgrade | 완료·연기·일정 액션 UX (**완료**) | `FollowUpQuickActionTile`, `ScheduleQuickActionTile`, `CalendarTab`, `FieldCommandCenterView`, `CustomerDetail360View` | 낮음 | mobile API smoke |
| 4. Contract Create / Contract Detail Polish | 계약 등록·요약 고도화 (**완료**) | `ContractCreateScreen`, `ContractSummaryCard`, `ContractsTab`, `CustomerDetail360View` | 중간 | Web 동일 필드·RBAC |
| 5. Global Search / Quick Create | 통합 검색·빠른 실행 (**완료**) | `GlobalSearchScreen`, `BoaQuickCreateStrip`, Shell AppBar | 중간 | 검색 scope 서버 검증 |
| 6. Push Preferences / Notifications Polish | 완료 — 알림 UX·설정 polish | `PushPreferencesScreen`, `NotificationsTab`, `NotificationActionTile` | — | push policy checklist |
| 7. WebView Fallback Polish | 관리자 진입·로딩·뒤로가기 | `CrmWebScreen`, drawer | 낮음 | branch_admin WebView smoke |
| 8. Flutter APK Pilot Deployment Checklist | 내부 배포·FCM·OAuth | `apps/boa/android` | 중간 | PILOT_READINESS_RECHECKLIST |
| 9. Pilot Feedback Fix PR | 파일럿 피드백 반영 | TBD | 낮음 | operator UAT |
| 10. Capacitor Legacy Decision PR | Capacitor 유지/폐기 결정 | root `android/`, `capacitor.config.ts` | 중간 | 별도 승인·롤백 계획 |

PRs 1–7 are **Flutter-only** unless a missing mobile API wrapper is required; any server change needs explicit approval and must not alter RBAC contracts.

## G. Security / RBAC Standards

- Flutter는 **서버 API/RBAC를 최종 기준**으로 따른다.
- 프론트 버튼 숨김은 **보조**일 뿐이다.
- 고객 scope는 **서버에서 검증**되어야 한다.
- `branch_admin` / `sub_branch_admin` / `team_leader` / `member` 권한 체계를 **변경하지 않는다**.
- `inactive` / `resigned` 사용자는 주요 API에서 **차단**되어야 한다.
- 실제 고객 데이터로 개발·검수하지 않는다 — `[TEST]` 데이터만 사용.

See [AGENTS.md](../AGENTS.md), [rbac-safety.md](./ops/rbac-safety.md).

## H. Push / Sensitive Data Standards

- Push title/body에 **고객명, 전화번호, 질병명, 상품명, 보험료, token, secret**을 넣지 않는다.
- Device token **원문**을 UI나 activity log에 표시하지 않는다.
- Firebase Admin JSON, `google-services.json`, `.env`, keystore, APK/AAB는 **커밋하지 않는다**.
- `user_device_tokens`, `push_notification_logs` **기존 정책을 유지**한다.

See [PUSH_NOTIFICATION_OPERATION_POLICY.md](./PUSH_NOTIFICATION_OPERATION_POLICY.md).

## I. Capacitor Fallback Standards

- Capacitor 구조는 **즉시 삭제하지 않는다**.
- Root `android/app`, `capacitor.config.ts`는 **별도 결정 PR 전까지 유지**한다.
- Flutter 파일럿 **안정화 후** Capacitor legacy 정리 여부를 결정한다.
- 삭제 또는 비활성화는 **별도 PR에서만** 진행한다.

See [ANDROID_INTERNAL_APK_SETUP.md](./ANDROID_INTERNAL_APK_SETUP.md).

## Related Documents

- [MOBILE_APP_ARCHITECTURE.md](./MOBILE_APP_ARCHITECTURE.md) — architecture source of truth
- [FLUTTER_ANDROID_APP.md](./FLUTTER_ANDROID_APP.md) — build and OAuth
- [PILOT_READINESS_RECHECKLIST.md](./PILOT_READINESS_RECHECKLIST.md) — pre-pilot gate
