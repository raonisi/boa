# BOA CRM CodeGraph 기반 고객·계약·상담·후속관리 2차 정밀 분석

이 문서는 `C:\work\boa-main`의 CodeGraph 인덱스를 기준으로 작성한 BOA CRM 고객·영업 흐름 운영용 2차 분석 문서다. 목적은 고객 등록부터 계약, 상담, 후속관리, 일정, 알림, 대시보드, 모바일 반영까지 이어지는 실제 보험 영업 흐름을 안전하게 변경하기 위한 기준점을 제공하는 것이다.

## 1. 최종 요약

- BOA CRM의 고객·영업 흐름은 `client/src/pages/CustomerList.tsx`와 `client/src/pages/CustomerDetail.tsx`에서 시작해 `server/routers.ts`의 `customers`, `contracts`, `consultations`, `followUps`, `schedules`, `notifications` router를 거쳐 `server/db.ts`와 `drizzle/schema.ts`의 테이블로 연결된다.
- 가장 중요한 workflow chains:
  - 고객 등록/목록/상세 -> 고객 접근권한 -> 상담/계약/후속관리 생성.
  - 고객 배정/담당자 변경/회수 -> 고객 소유권 변경 -> 대시보드/성과/알림 영향.
  - 계약 생성/수정/삭제 요청 -> 고객 상세/계약 목록/성과 집계/계약 알림 영향.
  - 상담 생성/수정 -> 고객 상태/장기 미관리 판단/영업 실행 점수 영향.
  - 후속관리 생성/오늘/연체/완료/연기/취소 -> 대시보드/모바일/알림 영향.
- 최고위험 편집 구역은 고객 접근/소유권, 고객 배정·회수·merge, 계약 삭제/삭제 요청, consultation content, follow-up status/date logic, notification/push payload privacy다.
- 이 맵은 future Codex 고객·영업 흐름 작업의 시작점으로 충분하다. 단, 실제 구현 전에는 변경 대상 route/query/UI section과 테스트를 다시 좁혀 확인해야 한다.

## 2. CodeGraph 사용 결과

- CodeGraph status: 정상, index up to date.
- Indexed files: `238`.
- Nodes: `3,361`.
- Edges: `6,817`.
- DB size: `7.57 MB`.
- Tools used: `codegraph_context`, `codegraph_explore`, `codegraph_impact`, `codegraph_search`, plus CLI `codegraph status`.
- Symbols/files inspected:
  - Customer: `CustomerList`, `CustomerDetail`, `verifyCustomerAccess`, `getCustomers`, `getCustomerById`, `createCustomer`, `updateCustomer`, `softDeleteCustomer`.
  - Contract: `ContractList`, `ContractModal`, `contracts`, `verifyContractDeleteAccess`, `verifyContractDeleteRequestAccess`.
  - Consultation: `ConsultModal`, `EditConsultModal`, `ConsultationToolsManagement`, `consultations`, `consultationChecklists`, `consultationCheckResults`, `messageTemplates`, `consultationScripts`.
  - Follow-up: `FollowUpPanel`, `FollowUpModal`, `verifyFollowUpAccess`, `getFollowUpScope`, `createFollowUp`, `getFollowUps`.
  - Schedule/Notification/Push: `getAccessibleSchedules`, `createNotificationSafe`, `sendPushToUsers`, `runSchedulePushReminderEngine`, `runBusinessPushReminderEngine`.
  - Mobile: `server/mobileRoutes.ts`, Flutter customer/contract/calendar/notification providers and tabs.
- Impact/caller/callee analysis summary:
  - `verifyCustomerAccess` affects customer delete, contract delete, contract delete request, follow-up access.
  - `getCustomers` affects duplicate checks, active phone set, push business reminders, operation risk, organization tree, dashboard data, sales reports, recommendations, work rhythm reports.
  - `getCustomerById` affects merge preview/execute, customer access, delete access, contract/follow-up access, reclaim.
  - `createNotificationSafe` affects contract, birthday, reconsult, payment, schedule, uncontacted, long-unmanaged reminders.
  - `sendPushToUsers` affects notification bridge, contract delete request push, schedule push engine, business push engine.
- Native read/grep was still needed:
  - To confirm exact tRPC router names in `server/routers.ts`.
  - To confirm mobile REST path strings in `server/mobileRoutes.ts`.
  - To identify existing test candidates by filename.

## 3. 전체 영업 흐름 지도

| Stage | User action | UI entry | Server/API entry | DB/data touched | Downstream effect | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| customer registration | 신규 고객 입력 | `CustomerList`, create modal | `customers.create` | `customers` | list/detail/dashboard/search | ownership/scope mismatch |
| customer list/search/filter | 고객 DB 조회 | `CustomerList` | `customers.list`, mobile `/api/mobile/customers` | `customers`, recommendations | dashboard/action prioritization | cross-scope customer exposure |
| customer detail | 고객 상세 확인 | `CustomerDetail` | `customers.get` | customer + related contracts/consultations/follow-ups | contract/consult/follow-up workflows | direct URL unowned access |
| duplicate check | 전화번호 중복 확인 | customer forms/import | `customers.checkDuplicate` | `customers.phone` | duplicate warning/import validation | scope leak through duplicate result |
| contract management | 계약 등록/수정/삭제 요청 | `CustomerDetail`, `ContractList` | `contracts.*`, `deleteRequests.*` | `contracts`, `contractHistory`, `deleteRequests` | performance, notifications, admin review | product/premium exposure |
| consultation record | 상담 기록 생성/수정 | `CustomerDetail` | `consultations.*` | `consultations`, checklist results | customer status, long-unmanaged logic | sensitive note exposure |
| follow-up creation | 다음 연락/업무 생성 | `CustomerDetail`, mobile | `followUps.create` | `follow_ups` | today/overdue/dashboard/mobile | wrong assignee/date |
| schedule linkage | 일정 생성/완료 | `Calendar`, mobile calendar | `schedules.*` | `schedules` | schedule push, dashboard | schedule scope leakage |
| notification/push linkage | 알림센터/FCM | `Notifications`, push pages | `notifications.*`, `pushNotifications.*` | `notifications`, `push_notification_logs` | mobile/web alerts | customer data in push/log |
| dashboard/performance reflection | 실적/업무 반영 | `Dashboard`, `Performance` | dashboard/performance routers | customers/contracts/follow-ups/schedules | branch/team/member metrics | aggregate leakage |
| mobile reflection | 앱에서 확인/처리 | Flutter tabs/providers | `/api/mobile/*` | same server data via tRPC caller | field workflows on device | mobile direct-route bypass |

## 4. 고객 관리 흐름

| Flow | UI file | Server route/procedure | DB/query function | RBAC gate | Risk | Required verification |
| --- | --- | --- | --- | --- | --- | --- |
| Customer list | `client/src/pages/CustomerList.tsx` | `customers.list` | `getCustomers` | role-scoped list filters | 타 조직 고객 노출 | branch/sub/team/member list tests |
| Customer detail | `client/src/pages/CustomerDetail.tsx` | `customers.get` | `getCustomerById` | `verifyCustomerAccess` | 직접 URL/API로 무관 고객 접근 | owned/unowned customer tests |
| Duplicate check | customer forms/import | `customers.checkDuplicate` | `checkPhoneDuplicate` -> `getCustomers` | phone duplicate scope | 중복 결과로 타 범위 고객 존재 노출 | same/other scope duplicate tests |
| Create | `CustomerList` create modal | `customers.create` | `createCustomer` | active user + create assignee policy | 잘못된 담당자/조직 소유권 | created owner/team/sub-branch assertions |
| Update | `CustomerDetail` edit modal | `customers.update` | `updateCustomer` | `verifyCustomerAccess` | 무관 고객 수정 | direct update forbidden tests |
| Deactivate | admin/customer actions | `customers.deactivate` | `softDeleteCustomer` | delete access and blockers | 활성 계약 고객 삭제 | role + active contract blocker tests |
| Assign to sub-branch | assignment UI | `customers.assignToSubBranch` | `assignCustomerToSubBranch` | `branchAdminProcedure` | 부지점 범위 오류 | target active/sub-branch tests |
| Assign/change agent | `CustomerAssign`, detail | `customers.assign`, `customers.changeAgent` | assignment helpers | `teamLeaderOrAboveProcedure`, target scope | 담당자/팀 오배정 | target user, team, history tests |
| Reclaim | manager flow | `customers.reclaim`, bulk reclaim | `reclaimCustomerDb`, transfer helpers | manager scope + reason | 부적절한 고객 회수 | reason/scope/bulk limit tests |
| Merge/import | merge/import pages | `customers.duplicateGroups`, `customers.merge`, `customers.bulkImport` | `mergeCustomers`, bulk helpers | `branchAdminProcedure` or `customerBulkImportProcedure` | 대량 데이터 변형/노출 | preview/execute/import validation tests |
| Deleted data linkage | deleted data page | `deletedData.*` | restore/permanent delete helpers | `branchAdminProcedure` | 복구/영구삭제 오남용 | branch_admin-only, audit, blockers |

## 5. 계약 관리 흐름

| Flow | UI file | Server route/procedure | DB/table | Linked customer data | Risk | Required verification |
| --- | --- | --- | --- | --- | --- | --- |
| Contract list by customer | `CustomerDetail` | `contracts.listByCustomer` | `contracts` | `customerId`, customer access | 고객 상세에서 무관 계약 노출 | unowned customer negative |
| Contract list | `ContractList` | `contracts.list` | `contracts`, customers/users joins as needed | customer/agent context | branch scope vs mine scope 오류 | role/scope filter tests |
| Contract create | `CustomerDetail` `ContractModal` | `contracts.create` | `contracts`, `contractHistory` | customerId, agentId | 잘못된 customer/agent 연결 | owner/customer access tests |
| Contract update | `CustomerDetail`, `ContractList` | `contracts.update` | `contracts`, `contractHistory` | customerId, product/premium | 상품명/보험료 노출 또는 권한 우회 | update forbidden and history tests |
| Contract history | customer/detail pages | `contracts.contractHistory` | `contractHistory` | contractId/customerId | 타 계약 이력 노출 | contract access tests |
| Contract deactivate/delete | `ContractList`, deleted data/admin | `contracts.deactivate`, `deletedData.permanentDeleteContract` | `contracts`, delete/audit logs | customer and contract | P0 destructive action | branch_admin-only, blocker, audit tests |
| Contract delete request | `ContractList` | `deleteRequests.createContractDeleteRequest` | `deleteRequests` | contractId, customer scope | 무관 계약 삭제 요청 | non-admin scoped request tests |
| Performance/dashboard relation | dashboards/performance | performance routers | `contracts.contractDate`, premium/status | agent/customer owner | aggregate leakage | scoped aggregate tests |

## 6. 상담 관리 흐름

| Flow | UI file | Server route/procedure | DB/table | Sensitive data risk | Required verification |
| --- | --- | --- | --- | --- | --- |
| Consultation list | `CustomerDetail` | `consultations.list` | `consultations` | 상담 내용/요약 노출 | `verifyCustomerAccess` and unowned customer tests |
| Consultation create | `CustomerDetail` `ConsultModal` | `consultations.create` | `consultations`, maybe status/customer updates | 상담 내용, next action | content length, customer scope, status effects |
| Consultation update | `CustomerDetail` `EditConsultModal` | `consultations.update` | `consultations` | 기존 상담 내용 수정 | owner/customer scope and audit if present |
| Checklist templates | `ConsultationToolsManagement` | `customers.consultationTools.*` | `consultationChecklists` | template content | branch_admin management tests |
| Checklist results | `CustomerDetail` | customer check routes | `consultationCheckResults` | customer-specific checklist state | customer access and result mutation tests |
| Message templates | `ConsultationToolsManagement` | message template routes | `messageTemplates` | compliance wording | template validation and admin-only tests |
| Consultation scripts | `ConsultationToolsManagement` | script routes | `consultationScripts` | script body, placeholders | banned phrase/placeholders tests |

## 7. 후속관리 흐름

| Flow | UI/API entry | Server procedure | DB/query | Status/date logic | Risk | Required tests |
| --- | --- | --- | --- | --- | --- | --- |
| Create | `CustomerDetail`, mobile `/customers/:id/follow-ups` | `followUps.create` | `createFollowUp` | `nextContactDate`, status `scheduled` | wrong assignee/customer | create scoped tests |
| List by customer | `CustomerDetail`, mobile customer follow-ups | `followUps.listByCustomer` | `getFollowUps` | customerId filter | unowned customer follow-ups | unowned negative |
| Today | dashboard/mobile | `followUps.listToday` | `getFollowUps` | KST day range, scheduled/postponed | missing/extra work items | today boundary tests |
| Overdue | dashboard/mobile | `followUps.listOverdue` | `getFollowUps` | due date before today | overdue misclassification | overdue boundary tests |
| Complete | UI/mobile action | `followUps.complete` | `updateFollowUp` | status `completed`, completedAt | completing unowned work | `verifyFollowUpAccess` negative |
| Postpone | UI/mobile action | `followUps.postpone` | `updateFollowUp` | nextContactDate, status `postponed` | duplicate/incorrect due date | postpone date/status tests |
| Cancel | UI/mobile action | `followUps.cancel` | `updateFollowUp` | status `cancelled` | canceling wrong task | cancel forbidden tests |
| Dashboard linkage | dashboard widgets | dashboard/follow-up routes | `follow_ups` | today/overdue counts | aggregate leakage | role aggregate tests |

## 8. 일정·캘린더 연결 흐름

| Flow | Key files | Data touched | RBAC dependency | Notification dependency | Risk |
| --- | --- | --- | --- | --- | --- |
| Schedule list | `client/src/pages/Calendar.tsx`, `server/routers.ts`, Flutter calendar tab | `schedules` | `getAccessibleSchedules` | none directly | 타 사용자 일정 노출 |
| Schedule create | calendar/mobile | `title`, `type`, `startTime`, `endTime`, `customerId`, `reminderOffsetMinutes` | active user + target validation | schedule reminder/incomplete push candidate | wrong target/customer linkage |
| Schedule update/delete | calendar/mobile complete | `status`, `completedAt`, `deletedAt`, `isActive` | schedule scope | cancel timing/incomplete notifications | unowned schedule mutation |
| Follow-up to schedule linkage | customer workflow | customer/follow-up/schedule dates | customer/follow-up access | may generate reminders | duplicated work or missed reminder |
| Reminder offset | `server/pushNotifications.ts`, `shared/timePolicy.ts` | `reminderOffsetMinutes`, `startTime`, `endTime` | schedule owner/userId | `runSchedulePushReminderEngine` | missed or duplicate push |
| Mobile calendar | `apps/boa/lib/features/calendar/calendar_tab.dart` | schedules/follow-ups | mobile authenticated caller | mobile notifications | route bypass or stale state |

## 9. 알림·푸시 연결 흐름

| Trigger | Notification path | Push path | Data included | Data intentionally excluded | Risk | Verification needed |
| --- | --- | --- | --- | --- | --- | --- |
| Contract milestone | `createContractReminders`, `createNotificationSafe` | business push engine | generic type/source ids | customer name, phone, product, premium | sensitive payload/log | payload/log privacy tests |
| Birthday | `createBirthdayReminder` | business push engine | generic customer reminder type | birthdate/name | PII exposure | payload excludes birthdate/name |
| Reconsult/payment/uncontacted | notification helpers | optional bridge/engine | generic notification metadata | detailed notes/customer PII | over-notification | dedupe and scope tests |
| Schedule reminder | `createScheduleReminderByOffset`, `createScheduleReminders` | `runSchedulePushReminderEngine` | schedule source/type, safe body | customer/schedule sensitive detail | missed/duplicate push | due window and dedupe tests |
| Schedule incomplete | `createScheduleIncompleteReminder` | schedule push engine | generic incomplete message | customer/schedule title | repeated push | incomplete dedupe tests |
| Contract delete request | delete request flow | `sendContractDeleteRequestPush` | delete_request id/type | contract product/premium/customer | admin push leakage | branch_admin target + safe payload |
| Notification center read/process | `notifications.markRead/updateProcessStatus` | none direct | read/process status | unrelated notification details | status mutation outside scope | `verifyNotificationAccess` tests |
| Push operation/manual engine | push ops page | `sendPushToUsers` | status/type/source/dedupe | raw token/customer data | token exposure/mass push | branch_admin and log privacy |

## 10. 대시보드·성과 반영 흐름

| Metric/Widget | Source data | Query/server function | UI file | Role scope risk | Verification needed |
| --- | --- | --- | --- | --- | --- |
| Customer counts | `customers` | `getCustomers`, dashboard helpers | `Dashboard.tsx`, mobile home | branch/team/member aggregate leakage | scoped fixture tests |
| Follow-up today/overdue | `follow_ups` | `getFollowUps`, `getFollowUpScope` | Dashboard/mobile home | unowned work count leakage | role/date boundary tests |
| Contract/performance stats | `contracts`, goals | performance routers, `getSalesFunnelAggregates` | `Performance.tsx`, `PerformanceGoals.tsx` | cross-team performance leakage | branch/sub/team/member aggregate tests |
| Sales funnel | `customers.consultStatus`, contracts | sales funnel/report helpers | analytics/sales pages | lower role seeing branch funnel | role scope tests |
| Operation risk | customers/contracts/follow-ups/schedules/logs | `buildOperationRiskReport`, scoped summaries | `OperationRiskCenter.tsx` | manager aggregate/log leakage | manager role matrix |
| Goal dashboard | `performanceGoals`, contracts/follow-ups | goals dashboard routes | goal cards/pages/mobile | target scope mismatch | target role/team tests |

## 11. 모바일 앱 연결 흐름

| Mobile flow | Flutter file | Server mobile route | Data touched | RBAC/auth check | Verification needed |
| --- | --- | --- | --- | --- | --- |
| Mobile auth/session | `apps/boa/lib/features/auth/sign_in_screen.dart`, `session_controller.dart` | `/api/mobile/auth/google`, `/api/mobile/auth/me` | session user | Google token + active account | real login/device tests |
| Customer list/detail | `customers_tab.dart`, `customer_detail_screen.dart` | `/api/mobile/customers`, `/api/mobile/customers/:customerId` | customer fields | tRPC caller with user context | role-scoped mobile tests |
| Customer contracts | `customer_contracts_provider.dart`, `contracts_tab.dart` | `/api/mobile/customers/:customerId/contracts`, `/api/mobile/contracts` | contracts | contract/customer scope via caller | unowned customer negative |
| Customer follow-ups | `customer_followups_provider.dart`, customer detail | `/api/mobile/customers/:customerId/follow-ups` | follow-ups | customer/follow-up scope | create/list negative tests |
| Calendar/follow-up work | `calendar_tab.dart`, `mobile_work_api.dart` | `/api/mobile/follow-ups/*`, `/api/mobile/schedules*` | schedules/follow-ups | authenticated caller + tRPC scope | complete/postpone/cancel direct route tests |
| Notifications | `notifications_tab.dart`, `notifications_providers.dart` | `/api/mobile/notifications*` | notifications | notification router scope | read/read-all scope tests |
| Dashboard/performance | `home_tab.dart`, performance/goals providers | `/api/mobile/dashboard/today-work`, `/performance/stats`, `/performance-goals/dashboard` | aggregate metrics | scoped tRPC caller | aggregate leakage tests |
| Push preferences/token | `device_token_registration.dart`, `push_preferences_screen.dart` | `/device-tokens/register`, `/push-preferences` | token/prefs | active authenticated user | token not logged, prefs self-only |

## 12. 데이터 모델 연결 지도

| Table | Business role | Linked flows | Sensitive fields | Risk if changed |
| --- | --- | --- | --- | --- |
| `users` | role/account hierarchy | auth, RBAC, assignment, performance | role, accountStatus, teamId, parent/subBranch ids | global access breakage |
| `teams` | organization scope | team leadership, assignment, dashboard | team id/sub-branch relation | team scope leakage |
| `customers` | core sales lead/customer | list/detail/create/update/assign/merge/import | name, phone, birthDate, premium expectation, memo | P0 customer data leakage/ownership drift |
| `contracts` | policy/contract business record | contract list/create/update/history/delete | productName, monthlyPremium, contractDate | premium/product exposure or stats drift |
| `consultations` | customer interaction history | consultation list/create/update, long unmanaged | content, summary, nextAction | sensitive notes exposure |
| `consultationChecklists` | 상담 도구 template | consultation tools | template labels/content | admin tool corruption |
| `consultationCheckResults` | customer checklist state | customer detail checklist | customer-specific checklist memo | customer-specific leakage |
| `messageTemplates` | 상담/문자 template | template rendering/log copy | body/compliance notes | unsafe phrase/template misuse |
| `consultationScripts` | 상담 script | script render/copy | script body/placeholders | customer-context rendering errors |
| `follow_ups` | next action/work queue | today/overdue/complete/postpone/cancel | reason, memo, nextContactDate | wrong assignee/date/status |
| `schedules` | calendar/reminders | calendar/mobile/schedule push | title, memo, customerId, times | schedule/customer context leakage |
| `notifications` | web notification center | list/read/process status | title/message/relatedId | cross-user notification exposure |
| `user_device_tokens` | Android FCM target | push registration/send | raw token | token exposure |
| `push_notification_logs` | push audit/dedupe | push ops/logs | type, sourceId, dedupeKey, status | sensitive metadata/log privacy |

## 13. 고위험 편집 구역 P0/P1/P2/P3

P0:
- customer access and ownership scope
- customer assignment/reassignment
- customer merge/delete/restore/permanent delete
- contract delete/delete request
- DB schema/migration touching customer/contract/follow-up/schedule ownership
- notification/push payload privacy

P1:
- `server/routers.ts` customer/contract/consultation/follow-up procedures
- `server/db.ts` scoped query filters
- mobile REST routes for customer/follow-up/schedule/notification
- dashboard/performance aggregate scope
- consultation notes exposure

P2:
- customer/contract/consultation/follow-up UI forms
- mobile screens/providers
- status/date display logic
- filters/search/sort/pagination
- role-based UI visibility

P3:
- docs
- copy
- isolated visual polish
- non-sensitive layout changes
- tests-only improvements

## 14. 테스트 전략

| Flow | Positive tests | Negative tests | UI tests | Mobile tests | Existing candidates | Missing tests |
| --- | --- | --- | --- | --- | --- | --- |
| customer list/detail per role | branch/sub/team/member scoped list/detail | unowned/other team denied | CustomerList/CustomerDetail smoke | `/api/mobile/customers` | `server/crm.test.ts`, `server/rbac-seed.test.ts` | full role matrix per route |
| customer duplicate check | same-scope duplicate detected | out-of-scope duplicate not leaked | create/import form | N/A | `server/crm.test.ts` | duplicate scope edge cases |
| customer create/update/deactivate | valid scoped changes | invalid target/unowned/deactivate blocked | customer forms | mobile detail if applicable | `server/crm.test.ts` | deactivate blocker coverage |
| assignment/change agent | manager assigns valid subordinate | unrelated/inactive target rejected | CustomerAssign | N/A | `server/crm.test.ts` | bulk reassignment/reclaim matrix |
| contract create/update/history/delete request | scoped contract lifecycle | unowned contract/customer denied | `ContractList.test.tsx` | mobile contracts routes | `server/crm.test.ts`, `ContractList.test.tsx` | delete request role matrix |
| consultation create/update | scoped customer consultation | unowned customer denied | CustomerDetail modal | N/A | `server/crm.test.ts` | consultation tools/admin tests |
| follow-up today/overdue/complete/postpone/cancel | own/scoped work transitions | unowned follow-up denied | CustomerDetail follow-up panel | mobile follow-up routes | `server/mobileRoutes.test.ts`, `server/crm.test.ts` | KST boundary/status matrix |
| schedule create/update/delete/complete | scoped schedule lifecycle | unowned schedule mutation denied | Calendar page | mobile schedules | `server/mobileRoutes.test.ts`, `server/crm.test.ts` | reminderOffset edge cases |
| notification read/process status | own/subordinate notification update | unrelated notification denied | Notifications page | mobile notifications | notification-related server tests | processStatus role matrix |
| push payload privacy | safe generic payload/log | customer data/token absent | push operations page | real device optional | `server/internalPushSchedulerRoutes.test.ts`, `server/crm.test.ts` | per push type privacy assertions |
| dashboard aggregate scope | scoped counts/stats | lower role cannot see branch aggregate | dashboard/performance pages | mobile dashboard/performance | `server/analytics-rbac.test.ts`, `server/rbac-seed.test.ts` | sales funnel/goal edge cases |

## 15. 앞으로 Codex가 고객·영업 흐름 작업 전 반드시 해야 할 절차

1. Run `codegraph status`.
2. Identify UI entry and server route.
3. Trace DB/query function.
4. Trace RBAC gate.
5. Run impact analysis on shared functions.
6. Check downstream schedule/notification/dashboard/mobile effects.
7. Read narrowed exact file sections.
8. Check `docs/ops/rbac-safety-checklist.md` and `docs/ops/database-migration-safety.md` if relevant.
9. Run targeted tests plus `pnpm.cmd check`.
10. Report P0/P1 risks before editing if applicable.

## 16. 정보 부족 / Needs verification

- Live DB state.
- Real customer data distribution.
- Production role hierarchy.
- Railway variables.
- Firebase/FCM delivery.
- Browser/device UI behavior.
- Real mobile session behavior.
- Current deployment status.
- Whether production seed/fixture assumptions match current live data.
- Whether every dashboard/performance aggregate has complete negative tests.

## 17. 최종 판정

이 workflow map은 향후 고객·영업 흐름 작업을 안전하게 시작하기에 충분하다. 특히 UI entry, server route, DB/query function, RBAC gate, downstream effects를 한 번에 추적하기 위한 기준으로 사용할 수 있다.

다만 다음 흐름은 수정 전 더 깊은 3차 분석이 필요하다:
- customer assignment/changeAgent/reclaim/merge/import
- contract delete/delete request/permanent delete
- consultation content and template/script rendering
- follow-up and schedule date/status boundary logic
- notification/push payload privacy
- dashboard/performance aggregate scope
- mobile direct-route behavior

명시적 승인 없이 구현하면 안 되는 변경:
- 고객 접근/소유권 scope 변경
- 고객 배정/회수/merge/delete 정책 변경
- 계약 삭제/삭제 요청 정책 변경
- DB schema/migration touching ownership/scope
- push payload/log에 고객명, 전화번호, 생년월일, 질병명, 상품명, 보험료, raw token 추가
- production export/download/permanent delete 흐름 변경
