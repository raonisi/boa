# BOA CRM CodeGraph 기반 1차 아키텍처 맵

이 문서는 `C:\work\boa-main`의 CodeGraph 인덱스를 기준으로 작성한 BOA CRM 1차 운영용 아키텍처 맵이다. 향후 Codex 작업에서 불필요한 파일 읽기를 줄이고, RBAC/고객정보/DB/푸시 관련 변경을 더 안전하게 시작하기 위한 참조 문서로 사용한다.

## 1. 최종 요약

- BOA CRM은 `client/src` React 웹 CRM, `server` Express/tRPC 백엔드, `drizzle` DB schema/migration, `shared` 공통 정책, `apps/boa` Flutter Android 앱, `android` Capacitor shell이 함께 있는 monorepo 구조다.
- 핵심 실행 진입점은 `server/_core/index.ts`이며, `/api/trpc`, OAuth, internal push scheduler, mobile REST routes, 정적 웹 서빙을 연결한다.
- 가장 중요한 흐름은 `Auth/Session`, `RBAC/customer scope`, `customer/contract/consultation`, `follow-up/schedule`, `notification/push`다.
- 향후 작업에서 특히 조심할 영역은 `server/routers.ts`의 `verifyCustomerAccess`, `server/_core/procedures.ts`의 role procedure guard, `server/db.ts`의 query scope, `server/pushNotifications.ts`의 push gate, `drizzle/schema.ts`의 schema다.

## 2. CodeGraph 사용 결과

- CodeGraph status: 정상, index up to date.
- Indexed files: `238`.
- Nodes: `3,361`.
- Edges: `6,817`.
- DB size: `7.57 MB`.
- Indexed languages: `tsx 113`, `typescript 74`, `dart 43`, `kotlin 4`, `java 3`, `javascript 1`.
- Nodes by kind: `import 1,228`, `function 1,031`, `constant 305`, `file 238`, `type_alias 226`, `method 166`, `class 76`, `route 32`, `interface 29`, `enum_member 15`, `variable 11`, `enum 4`.
- CodeGraph tools used during analysis: `codegraph_status`, `codegraph_files`, `codegraph_context`, `codegraph_explore`, `codegraph_impact`.
- CodeGraph impact 확인:
  - `verifyCustomerAccess` 영향: `verifyCustomerDeleteAccess`, `verifyContractDeleteAccess`, `verifyContractDeleteRequestAccess`, `verifyFollowUpAccess`.
  - `sendPushToUsers` 영향: `sendDuePushForNotification`, `sendContractDeleteRequestPush`, `runSchedulePushReminderEngine`, `runBusinessPushReminderEngine`, `runPushReminderEngines`.
- Native grep/read가 필요했던 곳:
  - `package.json`, `vite.config.ts`, `vitest.config.ts`, Railway/deploy 설정 파일 존재 여부는 CodeGraph 인덱스 대상이 아니어서 직접 확인했다.
  - `server/routers.ts`의 tRPC router property 이름은 CodeGraph symbol만으로 부족해 특정 줄 범위를 직접 확인했다.

## 3. 주요 폴더 구조

| Path | Role | Notes |
| --- | --- | --- |
| `client/src` | 웹 CRM React 앱 | `App.tsx`, `pages`, `components`, `hooks`, `lib/trpc` 중심 |
| `server` | Express/tRPC 백엔드 | `routers.ts`, `db.ts`, mobile routes, push/notification engine |
| `server/_core` | 서버 부트/auth/trpc/core infra | `index.ts`, `procedures.ts`, `context.ts`, `oauth.ts`, `sdk.ts` |
| `drizzle` | DB schema/migrations | `schema.ts`, `relations.ts`, migration SQL |
| `shared` | 공통 정책/타입 | permissions, timePolicy, salesPipeline, customerExecution |
| `apps/boa` | Flutter Android 앱 | mobile CRM shell, auth, customer/contract/calendar/notification screens |
| `android` | Capacitor Android shell | web CRM wrapper/build output 쪽 |
| `e2e` | Playwright smoke | `core-smoke.spec.ts`, fixtures |
| `docs/ops` | Codex 운영 기준 | RBAC, QA, UI/UX, migration, report standards |
| `scripts` | 운영/보정 스크립트 | activity log redaction 등 |
| `dist` | build output | generated output, 직접 수정 대상 아님 |

## 4. 핵심 도메인별 구조

### 1. Auth / Session

- Main entry files: `server/_core/index.ts`, `server/_core/oauth.ts`, `server/_core/context.ts`, `client/src/App.tsx`, `apps/boa/lib/core/auth/session_controller.dart`.
- Related routes/API handlers: web tRPC `/api/trpc`; mobile Google login `/api/mobile/auth/google`, session bridge `/api/mobile/web-session`, `/api/mobile/auth/me` in `server/mobileRoutes.ts`.
- Related UI pages/components: `AuthGuard`, `AdminGuard`, `ManagerGuard`, `SubBranchAdminOrAboveGuard` in `client/src/App.tsx`.
- Related services/utilities: `createContext`, `protectedProcedure`, mobile `getAuthenticatedUser`.
- Data/RBAC risk points: inactive/resigned filtering must stay server-side; client guards are not sufficient.
- Verification gaps: OAuth provider/env and real cookie behavior need live/dev verification.

### 2. RBAC / Permission

- Main entry files: `server/_core/procedures.ts`, `server/routers.ts`, `shared/permissions.ts`, `client/src/App.tsx`.
- Related routes/API handlers: all tRPC routers use `activeUserProcedure`, `branchAdminProcedure`, `teamLeaderOrAboveProcedure`, etc.
- Related UI pages/components: role guards in `App.tsx`, nav role filtering in `client/src/components/DashboardLayout.tsx`, mobile menu in `client/src/components/MobileNav.tsx`.
- Related services/utilities: `verifyCustomerAccess`, `verifyTargetUserAccess`, `getHierarchyScopeUserIds`, `getAccessibleSchedules`, `getFollowUpScope`.
- Data/RBAC risk points: server-side authorization is authoritative; UI route/nav hiding must not be treated as security.
- Verification gaps: role matrix should be tested per API path before RBAC changes.

### 3. Customer

- Main entry files: `client/src/pages/CustomerList.tsx`, `client/src/pages/CustomerDetail.tsx`, `server/routers.ts`, `server/db.ts`.
- Related routes/API handlers: `customers.list/get/checkDuplicate/create/update/deactivate/assign/changeAgent/reclaim`, mobile `/api/mobile/customers`, `/api/mobile/customers/:customerId`.
- Related UI pages/components: customer list, customer detail, create/edit modal, assignment screens, bulk import, duplicate merge.
- Related services/utilities: `getCustomers`, `getCustomerById`, `createCustomer`, `updateCustomer`, `softDeleteCustomer`, `verifyCustomerAccess`.
- Data/RBAC risk points: customer visibility is role-scoped; assignment flows are high-risk.
- Verification gaps: bulk import/merge flows need separate deep map if changed.

### 4. Contract

- Main entry files: `client/src/pages/ContractList.tsx`, `client/src/pages/CustomerDetail.tsx`, `server/routers.ts`.
- Related routes/API handlers: `contracts.listByCustomer`, `contracts.list`, `contracts.contractHistory`, `contracts.create`, `contracts.update`, `contracts.deactivate`.
- Related UI pages/components: contract list, customer detail contract modal, delete request/admin approval screens.
- Related services/utilities: `verifyContractDeleteAccess`, `verifyContractDeleteRequestAccess`, `getContractById`, `getContractsByCustomer`.
- Data/RBAC risk points: product name, premium, contractDate are sensitive in push/log contexts; deletion uses branch-admin and delete request flows.
- Verification gaps: contract history and delete request approval should be tested before edits.

### 5. Consultation

- Main entry files: `client/src/pages/CustomerDetail.tsx`, `client/src/pages/ConsultationToolsManagement.tsx`, `server/routers.ts`.
- Related routes/API handlers: `consultations.list/create/update`; consultation tools are nested under `customers.consultationTools`.
- Related UI pages/components: consultation modal, edit consultation modal, consultation tools management, checklists, message templates, scripts.
- Related services/utilities: `getConsultationsByCustomer`, `getLatestConsultationDatesByCustomerIds`, template/script validation helpers.
- Data/RBAC risk points: consultation content may contain customer-sensitive operational notes; list/update must pass customer access.
- Verification gaps: exact frontend form behavior and tool template validation need UI-specific mapping.

### 6. Follow-up

- Main entry files: `client/src/pages/CustomerDetail.tsx`, `server/routers.ts`, `server/db.ts`, `apps/boa/lib/features/calendar/calendar_tab.dart`.
- Related routes/API handlers: `followUps.create/listByCustomer/listToday/listOverdue/complete/postpone/cancel`, mobile `/api/mobile/follow-ups/today`, `/overdue`, complete/postpone/cancel.
- Related UI pages/components: customer detail follow-up panel, follow-up modal, mobile calendar/follow-up cards.
- Related services/utilities: `createFollowUp`, `getFollowUpById`, `getFollowUps`, `updateFollowUp`, `verifyFollowUpAccess`.
- Data/RBAC risk points: `verifyFollowUpAccess` depends on `verifyCustomerAccess`; status/due ranges affect dashboard and push.
- Verification gaps: overdue/today KST date handling should be tested before scheduling edits.

### 7. Schedule

- Main entry files: `client/src/pages/Calendar.tsx`, `server/routers.ts`, `server/db.ts`, Flutter calendar tab.
- Related routes/API handlers: `schedules.list/create/update/delete`, mobile `/api/mobile/schedules`, `/api/mobile/schedules/:scheduleId/complete`.
- Related UI pages/components: web calendar, mobile schedule card, create schedule dialog.
- Related services/utilities: `getAccessibleSchedules`, `parseScheduleDateTime`, `assertScheduleEndAfterStart`, `getSchedulePushCandidates`.
- Data/RBAC risk points: `getAccessibleSchedules` scopes by role; push candidates depend on `reminderOffsetMinutes`, `startTime`, `endTime`, finished statuses.
- Verification gaps: status Korean enum display is shell-encoding sensitive; exact UI labels should be browser-verified before copy edits.

### 8. Notification / Push

- Main entry files: `server/notifications.ts`, `server/pushNotifications.ts`, `server/internalPushSchedulerRoutes.ts`, `server/pushReminderScheduler.ts`.
- Related routes/API handlers: `notifications.list/unreadCount/markRead/markAllRead/updateProcessStatus`, `pushNotifications.getPreferences/updatePreferences/listLogs/sendTestToMe/sendSchedulePushReminderEngine/sendBusinessPushReminderEngine`.
- Related UI pages/components: `client/src/pages/Notifications.tsx`, `client/src/pages/PushNotificationPreferences.tsx`, `client/src/pages/PushNotificationOperations.tsx`, Flutter notification tab/preferences.
- Related services/utilities: `createNotificationSafe`, `sendDuePushForNotification`, `sendPushToUsers`, `runPushReminderEngines`, `SAFE_PUSH_PAYLOADS`.
- Data/RBAC risk points: `sendPushToUsers` enforces preference, quiet hours, dedupe, no token, Firebase config, invalid-token deactivation; payloads are intentionally generic.
- Verification gaps: real Firebase delivery, Railway cron, and `PUSH_SCHEDULER_SECRET` are external/live checks.

### 9. Dashboard / Goals / Performance

- Main entry files: `client/src/pages/Dashboard.tsx`, `client/src/pages/Performance.tsx`, `client/src/pages/PerformanceGoals.tsx`, `server/routers.ts`.
- Related routes/API handlers: dashboard nested under follow-ups, performance/goals routes under `server/routers.ts`; mobile `/api/mobile/dashboard/today-work`, `/performance/stats`, `/performance-goals/dashboard`.
- Related UI pages/components: dashboard cards, performance goal summary, performance and goal pages, mobile home/performance screens.
- Related services/utilities: `buildPerformanceScope`, `getScopedDashboardData`, `getSalesFunnelAggregates`.
- Data/RBAC risk points: aggregate leakage across branch/team/member scope.
- Verification gaps: dashboards need role-specific fixture tests and UI smoke.

### 10. Admin / High-risk actions

- Main entry files: `client/src/App.tsx`, `server/routers.ts`, `client/src/pages/OperationRiskCenter.tsx`, `client/src/pages/Download.tsx`.
- Related routes/API handlers: user/team management, import batch management, customer merge, deleted data restore/permanent delete, operation-risk logs, downloads, push operations.
- Related UI pages/components: admin routes under `AdminGuard`, `ManagerGuard`, `DashboardLayout` admin nav group.
- Related services/utilities: `branchAdminProcedure`, `sanitizeActivityLogDetails`, delete/restore helpers, operation risk report helpers.
- Data/RBAC risk points: most must remain `branchAdminProcedure`; activity/audit metadata must stay redacted.
- Verification gaps: production delete/export requires explicit approval and focused tests.

### 11. Shared UI / Layout

- Main entry files: `client/src/components/DashboardLayout.tsx`, `client/src/components/MobileNav.tsx`, `client/src/components/ui/*`.
- Related routes/API handlers: none directly; layout consumes auth, permissions, tRPC hooks.
- Related UI pages/components: `navGroups`, `pageTitles`, sidebar, mobile nav, skeleton, forbidden/empty/error states.
- Related services/utilities: `useAuth`, `hasCustomerBulkImportAccess`, `useFcmDeviceTokenRegistration`, `getRoleLabel`.
- Data/RBAC risk points: navigation hiding is convenience, not security; role-guarded routes must match server procedures.
- Verification gaps: mobile layout, responsive tables, forbidden states require screenshots/browser checks.

### 12. Database / Query layer

- Main entry files: `drizzle/schema.ts`, `drizzle/relations.ts`, `server/db.ts`, `drizzle.config.ts`.
- Related routes/API handlers: almost all tRPC/mobile routes call `server/db.ts` directly or indirectly.
- Related UI pages/components: all domain UI depends on tRPC/mobile APIs backed by these queries.
- Related services/utilities: `getDb`, `runDbTransaction`, user/customer/contract/follow-up/schedule/notification query helpers.
- Data/RBAC risk points: schema changes, owner fields, `isActive/deletedAt`, dedupe unique constraints, push token storage.
- Verification gaps: live DB/Aiven/Railway schema cannot be inferred from local files.

### 13. Tests / QA

- Main entry files: `vitest.config.ts`, `e2e/core-smoke.spec.ts`, server tests under `server/*.test.ts`, client tests under `client/src/**/*.test.tsx`, Flutter tests under `apps/boa/test`.
- Related routes/API handlers: tests cover router, mobile route, push scheduler, RBAC seed, auth logout, bulk import, UI components.
- Related UI pages/components: `ErrorBoundary`, `ForbiddenState`, `empty-state`, selected page tests.
- Related services/utilities: Vitest, Playwright, Flutter test.
- Data/RBAC risk points: tests exist but do not prove production deployment or real device FCM.
- Verification gaps: exact coverage depth per domain needs separate test audit.

### 14. Deployment / Railway

- Main entry files: `package.json`, `server/_core/index.ts`, `vite.config.ts`, `docs/POST_MERGE_DEPLOY_CHECKLIST.md`.
- Related routes/API handlers: `/api/health`, `/api/internal/push-reminders/run`, `/api/trpc`, mobile REST routes.
- Related UI pages/components: production build serves `dist/public`.
- Related services/utilities: `pnpm build`, `pnpm start`, `serveStatic`, `startPushReminderScheduler`.
- Data/RBAC risk points: live env vars, cron secret, Firebase Admin config, DB URL are external deployment concerns.
- Verification gaps: no `railway.toml`, `nixpacks.toml`, `Dockerfile`, or `.github` workflow was found in this checkout; Railway service variables, cron, domain, deploy status require console/live verification.

## 5. RBAC-sensitive map

| Area | Roles involved | Key files | Risk | What to verify before editing |
| --- | --- | --- | --- | --- |
| Customer access | all roles | `server/routers.ts`, `server/db.ts` | Cross-team/customer leakage | positive/negative API tests per role |
| Customer assignment | branch_admin, sub_branch_admin, team_leader | `server/routers.ts` | Wrong owner/team/sub-branch transfer | assignment history, subordinate scope |
| Contract CRUD/delete | all roles, branch_admin | `server/routers.ts` | Contract data leakage or unsafe delete | customer access plus delete workflow tests |
| Follow-up actions | all roles | `server/routers.ts`, `server/db.ts` | Acting on another user's customer | `verifyFollowUpAccess` and status transitions |
| Schedule/calendar | all roles | `server/routers.ts`, `server/db.ts` | Seeing or completing another user's schedule | `getAccessibleSchedules` role matrix |
| Notifications | all roles | `server/routers.ts` | Reading subordinate/unrelated notifications | list/filter and markRead tests |
| Push operations | branch_admin, active users | `server/pushNotifications.ts`, `server/routers.ts` | Token exposure, mass push, duplicate push | payload/log privacy, dedupe, preference, quiet hours |
| Admin exports/delete | branch_admin | `server/routers.ts` | P0 data loss/exfiltration | explicit approval, audit log, no real customer data |

## 6. Customer-data exposure map

| Flow | Data touched | Key files | Exposure risk | Verification needed |
| --- | --- | --- | --- | --- |
| Customer list/detail | name, phone, birthDate, tags, status | `client/src/pages/CustomerList.tsx`, `server/routers.ts` | Unauthorized view/search | role-scoped list/detail tests |
| Contract management | productName, premium, contractDate | `client/src/pages/ContractList.tsx`, `drizzle/schema.ts` | Product/premium in logs or push | log/payload assertions |
| Consultation notes | summary/content/next action | `client/src/pages/CustomerDetail.tsx`, `drizzle/schema.ts` | Sensitive note exposure | customer access and audit redaction |
| Follow-up | reason, nextAction, memo | `server/db.ts`, `server/routers.ts` | Wrong assignee/team | owner/scope tests |
| Schedule | title, customerId, memo, time | `drizzle/schema.ts`, `server/routers.ts` | linked customer context leakage | schedule list/create/update role tests |
| Notification center | title/message/relatedId | `drizzle/schema.ts`, `server/routers.ts` | subordinate notification overexposure | `verifyNotificationAccess`, list filters |
| FCM push | generic titles/body/data only | `server/pushNotifications.ts` | customer data in push payload/log | payload/log privacy tests |
| Export/download | customers/contracts/schedules | `server/routers.ts` | bulk data exfiltration | branch_admin-only, audit log, reason/scope |

## 7. High-risk edit zones

- P0: `drizzle/schema.ts`, migration SQL, production DB commands, permanent delete/export flows, auth/session core, `verifyCustomerAccess`, `server/_core/procedures.ts`, push token storage/logging.
- P1: `server/routers.ts` domain routers, `server/db.ts` scoped query filters, `server/pushNotifications.ts`, `server/internalPushSchedulerRoutes.ts`, mobile auth/device-token routes.
- P2: customer/contract/calendar/notification UI pages, dashboard/performance aggregates, mobile Flutter providers/screens, shared time/permission helpers.
- P3: docs, copy, isolated visual polish, non-sensitive layout improvements, tests that do not alter runtime behavior.

## 8. Recommended future Codex task strategy

- Before feature work: run `codegraph_context` for the feature name, then `codegraph_explore` on the surfaced router/page/db symbols.
- Before RBAC changes: use `codegraph_impact` on `verifyCustomerAccess`, `getHierarchyScopeUserIds`, relevant procedure guards, then read exact router section.
- Before DB/migration changes: use `codegraph_files` for `drizzle` and `server/db.ts`, then inspect schema/migration docs; stop if production state is unknown.
- Before UI refactor: use CodeGraph to map route/page/component imports, then verify with browser screenshots.
- Before notification changes: start with `sendPushToUsers`, `createNotificationSafe`, `runPushReminderEngines`, `notifications` routes, and push log schema.
- Before release audit: combine CodeGraph structure with `pnpm.cmd check/test/build`, Playwright/browser evidence, and explicit Railway/device verification.

## 9. Missing information / Needs verification

- Railway project config, variables, cron, custom domain, and deploy status are not fully represented in repo files.
- Live DB schema and migration application state need Railway/Aiven or DB console evidence.
- Real Android FCM receipt cannot be proven from CodeGraph or local files.
- UI usability/mobile responsiveness needs browser or device screenshots.
- Exact test coverage depth per domain requires a separate test audit, not just test file discovery.
- Some Korean string literals appeared mojibake in shell reads; CodeGraph snippets showed cleaner text for key areas, but UI copy should be browser-verified before copy edits.

## 10. Final verdict

이 1차 아키텍처 맵은 향후 BOA CRM 작업에서 어느 파일부터 봐야 하는지, 어떤 shared function을 건드리면 위험한지, 어떤 검증이 필요한지 판단하는 데 충분한 운영 참조 문서다.

다만 실제 변경 작업 전에는 도메인별로 더 좁은 2차 맵이 필요하다. 특히 RBAC, customer assignment, DB migration, notification/push, export/delete, Railway deployment는 이 문서만으로 수정 판단을 끝내면 안 되고, 해당 영역의 route/query/test를 별도로 재확인해야 한다.
