# P2-03 오늘 예정 / 기한 경과 — 독립 검수 인계

작업: `IMPLEMENT-P2-03-TODAY-VS-OVERDUE-SCHEDULE-01`, 2026-09-14 Asia/Seoul.

구현자의 자체 검증 기록이다. **독립 검수는 미실시**이며 병합·배포 승인이 아니다.
**P2-03 IMPLEMENTATION CANDIDATE: PASS (아래 P2-03 범위의 자체 검증).**
KST 테스트 환경의 기존 E2E-N04 실패는 별도로 남아 있다. 최종 변경본 해시는 아래 외부 candidate manifest를 기준으로 확인한다.

## 1. 기준과 작업 공간

- 저장소: `raonisi/boa`
- BASE_SHA / HEAD / 작업 시작 시 fetch한 origin/main: `1804a4659ad0a7a676c27acc152f80fceae99fd1`
- 작업 브랜치: `codex/p2-03-today-overdue`
- 후보: `C:/work/boa-p2-03`
- 원본: `C:/work/boa-main`, main `0d87e5cd81278dcf3f15cce7a3d6aace0fd6e6af`, 사용자 파일 변경 없음.
- BASE 이력: P2-01 `60ea312` (#166), P2-02 `6759697` (#167), release identity `1804a46` (#168).
- 비교용 별도 읽기 전용 소스: `C:/work/boa-p203-baseline`, detached BASE. 원본 main을 전환하거나 reset/clean/stash하지 않았다.
- 루트 AGENTS.md, boa-crm-full-build 스킬, docs/ops 작업·RBAC·QA·UI·E2E 기준을 적용했다. 단일 에이전트로 수행했다.

## 2. 감사 요구와 현재 원인

원 감사는 수개월 전 미완료 일정을 오늘 일정이라는 이름과 집계에 섞는 문제다. 과거 업무 자체를 제거하는 요구가 아니다.

`dashboard.todayWork`는 권한이 적용된 원본에서 오늘 startTime과 미완료 deadline을 각각 판정한다. 오늘 판정의 `isSameCalendarDay`는 `isSameKstDate`를 호출한다. 미완료 후보는 `endTime ?? startTime <= baseDate`이며 완료·취소·노쇼를 제외한다.

서버는 `todaySchedules` / `incompleteSchedules`와 두 cards 집계를 별도로 반환한다. 각 배열은 기존대로 최대 8건이다. 클라이언트는 두 배열을 `type: schedule`로 합친 후 그 전체를 `schedule` 필터와 ‘오늘 일정’ count에 사용했다. 따라서 서버 분리가 화면에서 사라졌다.

## 3. 구현 및 날짜 정책

- `type: schedule`과 액션 taskType은 유지하고 `scheduleBucket: today | overdue`를 추가했다.
- 문자열은 기존 `parseKstLocalDateTime`으로 정규화하고 기존 `getKstDayRange`로 KST 날짜 경계를 얻는다. Date 객체도 동일한 경계를 사용한다.
- `startTime`의 KST 날짜가 기준일과 같으면 today, 이전이면 overdue다. 같은 날짜에 시간이 지난 미완료 일정도 today다.
- ID Map으로 중복을 제거한다. 두 source에 있으면 today source 사본을 우선하고, 기존 incomplete 우선순위와 이동 경로는 유지한다.
- 지연일수는 두 **KST 날짜 시작 시각**의 차이 / 86,400,000이다. 실제 약속 시각에서 경과한 시간을 floor하지 않는다. 과거는 최소 1일이다.
- 여러 날 일정도 startTime 날짜로 분류한다. 서버의 endTime 기반 미완료 후보 포함 여부는 바꾸지 않는다.
- 방어적으로 미래 source가 들어와도 all에서 삭제하지 않는다. today/overdue로 오표시하지 않으며 일반 ‘일정’으로 남는다. 정상 서버는 해당 미래 후보를 보내지 않는다.
- 큐 우선순위 숫자와 최종 정렬은 유지했다. 과거 일정은 기존 incomplete rank 30, 오늘 미완료 rank 30, 곧 시작 rank 40, 나머지 오늘 rank 60이다. 후속·알림·고객 경로/점수는 변경하지 않았다.
- 과거 일정 label만 ‘기한 경과’, 오늘 일반 일정 label은 ‘오늘 예정’으로 명확히 했다.

## 4. 제품 / 테스트 / 문서 변경 파일

| 구분 | 파일 | 이유 |
|---|---|---|
| 제품 | `client/src/lib/todayWorkExecution.ts` | KST bucket, ID 중복 제거, 원래 startTime·지연일수, 필터·집계 분리 |
| 제품 | `client/src/components/dashboard/TodayWorkExecutionQueue.tsx` | 다섯 필터, 안내·원래 예정일·지연일수·빈 상태·모바일 오늘 chip |
| 테스트 | `client/src/lib/todayWorkExecution.test.tsx` | T01–T12, 렌더링, UTC/KST, 여러 날·방어적 미래 후보 회귀 |
| 테스트 | `e2e/p2-03-today-overdue.spec.ts` (신규) | 네 역할 × 세 viewport, 합성 API 응답, 키보드/터치/레이아웃/axe/경로 |
| 테스트 | `e2e/core-smoke.spec.ts` | 직접 영향받는 기존 모바일 chip 기대 문구만 ‘오늘 예정’으로 변경 |
| 문서 | 이 파일 (신규) | 원인·정의·실제 결과·독립 검수 인계 |

제품 2개, 테스트 3개, 문서 1개다. 테스트 framework/config/package/lockfile 및 assertion 허용량은 바꾸지 않았다.

## 5. 필터와 숫자 정의

| key | 표시 | 포함 대상 |
|---|---|---|
| all | 전체 | 중복 제거 후 기존 실행 큐 전체 |
| schedule | 오늘 예정 | schedule + today bucket |
| overdueSchedule | 기한 경과 | schedule + overdue bucket |
| followup | 후속관리 | 기존 followup |
| notification | 알림 | 기존 notification + 장기 미관리 customer |

모든 count는 해당 필터의 **서버가 보내 준 실행 큐 후보 수**다. DB 전체 총량이 아니다. 큐의 기존 화면 노출 limit=5와 서버 각 일정 배열의 limit=8을 유지한다. 서버 cards의 `todayScheduleCount`/`incompleteScheduleCount` 의미 및 다른 모바일·보고서 소비처는 변경하지 않았다.

합성 E2E fixture: A=2026-05-21 14:00 KST, B=2026-09-14 14:00 KST, C=2026-09-14 09:00 KST(양쪽 source), 기준시각=2026-09-14 12:00 KST. 최종 all 3, 오늘 2(B/C), 기한 경과 1(A). A는 `원래 예정 2026-05-21 14:00 · 116일 지연`이다. 오늘 항목에는 ‘원래 예정’/‘0일 지연’ 문구를 붙이지 않는다.

## 6. 수정 전 재현과 단위 테스트

제품 코드 수정 전에 신규 테스트를 추가한 실행: **18 FAIL / 9 PASS (27)**, exit 1. 기존 6개는 통과했다. `pre-fix-unit.log`에 실제 실패가 보관돼 있다. 수정 후 동일 테스트와 기존 테스트를 합쳐 **27/27 PASS**다. 최종 대상 테스트 4파일 48/48 PASS, UTC 프로세스에서도 27/27 PASS다.

| ID | 확인 | 최종 |
|---|---|---|
| T01 | 오늘1+과거1 → all2/오늘1/경과1 | PASS |
| T02 | 오늘 필터 과거 ID 제외 | PASS |
| T03 | 기한 경과 필터 오늘 ID 제외 | PASS |
| T04 | source overlap 및 source 내부 중복, today 우선 | PASS |
| T05 | 과거 원래 startTime metadata, rank30/경로/액션 보존 | PASS |
| T06 | 전일 일정 1일 지연 | PASS |
| T07 | 월 경계 포함 116일 지연 | PASS |
| T08 | 00:30 KST와 전일23:30 → 1일 지연 | PASS |
| T09 | UTC/KST 날짜 차이, naive KST string, Date 객체 4사례 | PASS |
| T10 | 오늘·오늘 미완료에 지연 문구 없음 | PASS |
| T11 | 다섯 필터 count와 결과 일치, 전체 보존 | PASS |
| T12 | 후속·알림의 순서/우선순위/경로/액션 보존 | PASS |

렌더링: 오늘/경과 label·건수·aria-label·aria-pressed·빈 상태·모바일 chip·원래 예정일·지연일수·고객상세/후속등록/바로처리와 기존 후속의 일정보기 버튼을 확인했다.

## 7. E2E / 접근성

P2-03: branch_admin/sub_branch_admin/team_leader/member × 1440×900/390×844/320×740, 총 12사례. 고정 browser Date와 기존 mockBoaTrpc의 serialized response override만 사용했다. 운영 응답이나 실제 고객 자료는 사용하지 않았다.

다섯 필터 accessible name/count, aria-pressed, Tab → Enter → Tab → Space, 선택 후 focus 유지, ID 중복·상호 배제, 모바일 chip, 원래 예정일·지연일수, 가로 overflow, 텍스트 scrollWidth/scrollHeight, 모바일 필터 높이≥44px, 실제 ‘바로 처리’ 클릭의 `/calendar` 이동, API POST=0을 검사한다.

P2-03 최종 실행: **12/12 PASS, skip 0**. branch_admin 세 viewport의 큐 axe WCAG A/AA 위반 0. 별도 기존 접근성 gate **16/16 PASS**, baseline/규칙/skip 수정 0.

첫 P2-03 E2E는 코드 수정/HMR이 겹친 320px 클릭 1실패(11통과)였다. 해당 기록은 보존했다. 제품 코드를 고정한 후 전체 12개가 통과했고, 별도 JSON/화면 증거 저장을 추가한 최종 테스트도 실행했다. 실패를 skip하거나 force click으로 우회하지 않았다.

## 8. 실행 환경 및 실제 Quality Gate

모든 명령 cwd는 특별히 baseline이라고 표시한 경우 외 `C:/work/boa-p2-03`이다. Windows CMD + Node 24.15.0 + pnpm 10.4.1을 사용했다. PowerShell 실행 제약 때문에 CMD를 사용했다. 상속된 DB·발송·외부 서비스 자격증명을 제거하고 push scheduler를 비활성화했다. 후보에는 `.env` 파일이 없다.

| 명령 | 결과 | 증거 파일명 |
|---|---|---|
| `pnpm.cmd check` | 최종 exit0 | check-final.log |
| `pnpm.cmd test` | 113파일, 1186 PASS, exit0 | test-final.log |
| `pnpm.cmd test client/src/lib/todayWorkExecution.test.tsx client/src/lib/roleOperationalDashboard.test.tsx server/conversionDashboard.router.test.ts server/scheduleAuthorization.test.ts` | 48 PASS, exit0 | targeted-final.log |
| `pnpm.cmd test client/src/lib/todayWorkExecution.test.tsx` (`TZ=UTC`) | 27 PASS, exit0 | targeted-utc.log |
| `pnpm.cmd build` (`NODE_ENV=production`) | exit0 | build-production.log |
| `pnpm.cmd bundle:check` (위 build 산출물) | 4 budget PASS, exit0 | bundle-production.log |
| `pnpm.cmd test:e2e e2e/p2-03-today-overdue.spec.ts --project=desktop-chromium` | 12 PASS, exit0 | p203-evidence.log |
| `pnpm.cmd test:e2e:critical` (UTC 격리환경) | 12 PASS, exit0 | db-critical-utc.log |
| `pnpm.cmd test:e2e:accessibility` | 16 PASS, exit0 | db-accessibility.log |
| `pnpm.cmd test:e2e e2e/customer-list-count-sort.spec.ts e2e/customer-assign-query-state.spec.ts e2e/core-smoke.spec.ts e2e/role-responsive-smoke.spec.ts` | 273 PASS / 기존 조건부 48 SKIP, exit0 | regression-e2e.log |

E2E 명령에는 증거 루트 내의 전용 `--output=...`을 붙였다. 원문 전체 명령·cwd·시각·exit는 각 `.json` sidecar와 manifest에 기록한다. mock 회귀는 E2E_PORT=3188, 최종 P2-03 증거는 3189, DB gate는 3187로 분리했다.

초기 check는 ES5 타깃의 Map iterator 제약(TS2802)으로 실패했고, 제품의 `Array.from(schedules.values())` 한 줄로 해결했다. 타깃/config는 바꾸지 않았다.

초기 `NODE_ENV=test`를 상속한 build는 성공했으나 비표준 React 개발 산출물 때문에 bundle check가 실패했다. 정상 `NODE_ENV=production`으로 재빌드한 최종 산출물은 entry gzip 171.1/174.1 KiB, largest232.8/244.4 KiB, total JS792.8/826.0 KiB, CSS32.5/34.1 KiB로 통과했다. 초기 실패 로그도 남겼다. Vite의 900kB chunk 권고 warning은 남아 있다.

의존성: offline frozen install은 저장소 tarball 부족으로 실패했고 online frozen install은 성공했다. package/lock 변경 없음. 설치 시 lifecycle scripts를 실행하지 않았다.

## 9. 격리 DB 검증과 기존 환경 의존 실패

새 데이터 디렉터리 `C:/work/boa-p203-mysql-isolated/data`, loopback 전용 port33319, MySQL8.4.9, DB명boa_e2e를 생성했다. 기존 DB는 연결하지 않았다. 실제 포트/datadir를 검증한 뒤 기존 `pnpm.cmd db:migrate`와 `pnpm.cmd e2e:critical:seed`를 실행했다. 스키마/마이그레이션 **소스 수정은 없다**. 합성 seed와 Critical E2E는 격리 DB에 쓰기를 수행했다. 운영 DB 쓰기는 0이다.

최초 KST host + MySQL SYSTEM 환경에서 기존 E2E-N04 `report.deletionRisk.total`은 기대1/실제0으로 실패했다. 후보 전체 Critical은 11 PASS/1 FAIL, 수정 전 BASE의 동일 E2E-N04도 1 FAIL이었다. 서버/seed/assertion이 동일함을 비교했다.

GitHub Ubuntu/MySQL CI의 UTC 조건에 맞춰 **작업 전용 테스트 DB의 시간대와 자식 프로세스 TZ만** UTC로 설정했다. OS 시계·운영 설정·제품 코드·fixture·assertion은 변경하지 않았다. BASE E2E-N04는 1/1 PASS, 후보 전체 Critical은 12/12 PASS였다. 이는 KST 테스트 환경의 기존 시간대 의존 실패가 사라졌다는 제품 수정 주장이 아니다. P2-03 날짜 테스트 자체는 KST/UTC 프로세스 모두 통과한다.

이 기존 실패는 P2-03 범위 밖으로 남긴다. CI 조건의 PASS와 KST 조건의 FAIL을 혼동하지 말아야 한다. 테스트 종료 후 작업 전용 MySQL을 중지했다.

## 10. P203 수용 기준

| ID | 결과/근거 |
|---|---|
| P203-01 | PASS — T02 + 네 역할 E2E 오늘 필터 과거0 |
| P203-02 | PASS — T03 + E2E 경과 필터 오늘0 |
| P203-03 | PASS — T01/T11 + E2E all3/today2/overdue1 |
| P203-04 | PASS — T04 + E2E C 중복0 |
| P203-05 | PASS — T06–T09, KST/UTC 실행 |
| P203-06 | PASS — T05 + SSR + 세 viewport 원래 예정일 |
| P203-07 | PASS — T06–T08 + 116일 표시 |
| P203-08 | PASS — T10 + E2E 오늘에 지연 문구 없음 |
| P203-09 | PASS — T11 all 참조·내용 유지 |
| P203-10 | PASS — 기존 6개 + T12 + 관련 dashboard 단위·회귀 |
| P203-11 | PASS — 네 역할 1440×900 |
| P203-12 | PASS — 네 역할 390×844 |
| P203-13 | PASS — 네 역할 320×740 |
| P203-14 | PASS — keyboard/aria/44px/큐 axe + 기존 접근성16 |
| P203-15 | PASS — 전체 단위1186, 기존 UI 회귀273, 격리 Critical12; 서버/API/RBAC/DB/P2-01/P2-02 제품 변경0. 기존 KST E2E-N04 실패는 전후 동일 |

## 11. 영향과 비변경

server/routers.ts, server/db.ts, RBAC/verifyCustomerAccess, 고객 list/count/sort, F02 추천, 알림 우선순위, 후속 상태, release identity, Flutter, DB schema/migrations, package scripts/lockfile, GitHub workflow, Railway/Firebase 설정은 변경하지 않았다. API input/output 및 서버 cards 집계 의미를 보존했다. 네 역할 mock 통과를 운영 권한 검증으로 표현하지 않는다. 실제 서버 권한 회귀 근거는 격리 Critical E2E와 기존 단위 테스트다.

## 12. 검수본 식별·증거·복귀

외부 증거 루트: `C:/work/boa-p203-evidence-20260914`.
안전한 인계 증거: `handoff-evidence/`, 최종 식별 `candidate-manifest.json`, `full.patch`, `product.patch`, `tests.patch`, `SHA256SUMS.txt`.

manifest는 BASE/HEAD/브랜치, staged/unstaged/untracked, 6개 파일의 원문 SHA-256 및 Git canonical blob, diff 통계, patch SHA-256, 실행 결과, 허용된 증거의 해시를 포함한다. 새 파일은 HEAD에 없으므로 full.patch와 신규 파일 내용 해시를 함께 확인해야 한다. manifest 생성 후 후보 파일을 동결한다.

원본 로그는 실제 결과로 보관한다. JWT/cookie가 포함될 수 있는 Playwright trace 및 `.auth`, DB 파일, node_modules/dist/cache는 인계 대상에서 제외한다. 인계 화면과 fixture는 합성 자료만 포함한다. 원본 운영 고객·토큰·비밀값을 수집하지 않았다. db-migrate 초기 sidecar의 ‘DB empty’ 문구는 runner 설명 오류이며 별도 environment correction 기록으로 명시한다; 실제 격리 DB migration 성공 로그와 isolation 증거를 우선한다.

복귀는 후보를 채택하지 않고 BASE를 유지하는 것이다. 원본 사용자 작업 공간은 건드리지 않았다. 이 작업에서 reset/clean/stash 또는 자동 복귀 명령을 실행하지 않는다.

## 13. 미검증 / 다음 검수 집중 사항

1. **독립 검수 미실시**. 같은 manifest와 patch로 검수해야 한다. 파일이 바뀌면 해시·검증을 새로 생성한다.
2. KST host/DB의 기존 E2E-N04 시간대 의존 실패는 미해결이며 별도 범위다. nullable teamId backlog도 그대로다.
3. 큐 count는 기존 제한된 source 배열 기준이다. 서버 전체 cards 집계나 여러 날 일정의 서버 후보 정책을 확대하지 않았다.
4. 실기기/Flutter/운영 세션/운영 DB/다음 merge webhook은 미검증이다. 로컬 합성 Chromium 및 격리 MySQL 결과다.
5. 기존 쿼리 refresh/캐시 수명과 자정 이후 자동 재조회 정책은 변경하지 않았다. 날짜 판정은 builder가 호출될 때의 KST 기준시각을 사용한다.

## 14. 작업 종료 경계

commit 0 / push 0 / PR 0 / merge 0 / deploy 0 / Railway setting 0 / 운영 DB write 0 / 실제 발송 0 / P2-04 0.
합성 격리 DB 초기화·seed·기존 E2E 쓰기는 수행했고 테스트 DB 프로세스는 중지했다. 자동 다음 작업을 수행하지 않는다.
