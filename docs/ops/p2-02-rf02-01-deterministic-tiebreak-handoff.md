# RF02-01 결정적 추천 동점 정렬 — 구현자 자체 검증 및 인계

RF02-01 동점 결정성 수정: **PASS (로컬 자체 검증 범위)**. 독립 재검수: **미실시**.

2026-09-09 Asia/Seoul. 승인된 RF02-01만 수정했다. 과거 F02 자체 PASS를 독립 PASS로 재사용하지 않는다. P2-02 전체 최종 수용은 별도 검수자의 판단 대상이다. commit/push/PR/merge/deploy/P2-03은 실행하지 않았다.

## 1. 기준과 후보 식별

- 저장소: `https://github.com/raonisi/boa.git`, 작업 경로: `C:/work/boa-p2-02`.
- 브랜치: `fix/p2-02-customer-count-sort`.
- BASE_SHA = HEAD = `60ea31217c8901b8f5fcb9aacee3a5fb9fbe8f83`. P2-01 병합 #166이 포함된 기존 기준을 유지했다.
- 시작 F02 후보: `0ccc2dbabeb7ab43ea0f2ec650bb18ffd362c2691f4779ec1b3f637d91ccecfe`. 시작 18개 파일의 해시가 기존 manifest와 모두 일치했다.
- 새 코드·테스트 후보 ID: **`a3031bb3095746d0a06dbdc286cb343e3af10435ebd77d01d6db8be177521de7`**.
- 문서를 제외한 코드·테스트 20개 파일의 경로/바이트수/SHA256 JSON으로 후보 ID를 계산한다. 문서까지 포함한 전체 24개 파일은 별도 review manifest와 full patch 해시로 고정한다.
- 실행 지시: `C:/Users/이도현/Downloads/BOA_P2-02_RF02-01_Deterministic_Tiebreak_Implementation_Master_20260909.md`. 파일 SHA와 시작 상태는 `resumed-state.json`에 있다. 이전 `HOLD.md`는 당시 파일 부재 기록이며 현재 판정이 아니다.
- 적용 AGENTS.md, `boa-crm-full-build` SKILL.md, docs/ops의 workflow·RBAC·evidence·E2E 정책을 확인했다. 단일 에이전트로 작업했다.

새 증거 루트는 **`C:/work/boa-p2-02-rf02-01-20260909`**다. 아래 증거 파일명은 이 루트 기준이다. 기존 F02/F01/F03 증거를 덮어쓰지 않았다.

## 2. 원인 재확인과 실제 데이터 흐름

독립 보고서 `C:/work/boa-p2-02-f02-reaudit-20260909-4VN4Zw/REPORT.md`를 읽었다. 당시 PRE-style/최적화 SQL의 동일 점수·동일 생성일 고객 순서 차이로 team limit50 및 member limit25 cutoff 고객이 교체됐다. 기존 comparator가 점수만 비교하여 DB의 동점 반환 순서를 그대로 보존한 것이 원인이다. 기존의 우연한 순서를 계약으로 고정하지 않고, 사용자가 승인한 최종 순서 정책으로 해결한다.

**수정 전:** protectedProcedure 인증·상태 검사 → 서버 조직/담당 범위 계산 → `getRecommendationData`의 최소 고객 projection + 상담 aggregate + 계약/후속/알림 조회 → 기존 점수·urgency·경고·명분 계산 → 양수 점수 및 urgency 필터 → `totalScore DESC`만 정렬 → limit → includeWarnings 응답 처리. 고객 SELECT 자체는 `createdAt DESC`였으며 같은 날짜에는 명시적 보조 key가 없었다.

**수정 후:** 앞의 범위·SQL·점수 계산을 그대로 사용 → 동일 후보에서 `{items, customerCreatedAt}` 서버 내부 bundle 작성 → 기존 필터 → **`totalScore DESC → createdAt DESC → id ASC`** → 기존 limit 및 includeWarnings 처리. `priorityContacts`와 `dashboardSummary.topContacts`가 같은 순수 comparator를 사용한다. warning/reason/workRhythm은 bundle의 items만 사용하며 기존 의미와 순서를 유지한다.

`customer.id`는 MySQL int PK / JS number이고, `createdAt`은 NOT NULL timestamp / JS Date이다. 둘 다 기존 최소 projection에 존재한다. comparator는 별도 조회나 전역 상태 없이 같은 후보의 ReadonlyMap을 받아 비교한다. 없는 날짜에 새 fallback 정책을 만들지 않았다. 추가 map 및 createdAt은 공개 API로 반환하지 않는다. 기존 API에 rank 필드가 없으므로 rank는 배열 위치다.

## 3. 이번 변경 파일과 보존 파일

| 구분 | 경로 | 이유 |
|---|---|---|
| 제품/신규 | `server/recommendationOrder.ts` | 세 key의 순수 comparator 한 곳으로 고정 |
| 제품/수정 | `server/routers.ts` | 내부 날짜 map, 두 추천 정렬 연결, 직접 호출부의 bundle 해제 |
| 테스트/신규 | `server/recommendationOrder.test.ts` | 비교·대칭성·필터·limit·projection·반복·API 필드 15개 |
| 테스트/수정 | `tests/integration/recommendation-query.mysql.test.ts` | PRE 전체 후보 의미값 확보, 25 limit 추가, 정책 oracle 및 실제 SQL 회귀 |
| 테스트/신규 | `tests/integration/recommendation-order.oracle.ts` | 제품 comparator를 import하지 않는 독립 기대 순서·응답 구성 |
| 테스트/신규 | `tests/integration/recommendation-tiebreak.mysql.test.ts` | 60명 완전 동점·4역할·INSERT 순서·실제 projection·반복 검증 |
| 테스트/신규 | `tests/integration/recommendation-tiebreak.vitest.config.ts` | 위 테스트만 격리 실행하는 기존 방식 설정 |
| 문서/신규 | `docs/ops/p2-02-rf02-01-deterministic-tiebreak-handoff.md` | 이 인계 문서 |

`buildRecommendationItems`의 module export는 테스트에서 limit 전 전체 의미값을 검증하기 위한 서버 내부 접근이며 새 tRPC endpoint가 아니다. scorer 본문은 시작 후보와 동일하다.

전체 후보에 포함되지만 **이번에 바이트를 바꾸지 않은 16개 파일**:

| 구분 | 보존 파일 |
|---|---|
| P2-02 제품 | `client/src/pages/CustomerList.tsx`, `client/src/lib/customerListQueries.ts`, `server/db.ts` |
| 기존 단위 테스트 | `server/crm.test.ts`, `server/customers.scope-filter.test.ts`, `server/customer-list-counts.test.ts` |
| 기존 UI fixture/E2E | `e2e/fixtures/mock-trpc.ts`, `e2e/fixtures/customer-list-counts.ts`, `e2e/customer-list-count-sort.spec.ts` |
| F01 통합 | `tests/integration/customer-unassigned-scope.mysql.test.ts`, `tests/integration/customer-unassigned-scope.vitest.config.ts` |
| F02 통합 | `tests/integration/recommendation-query.fixture.ts`, `tests/integration/recommendation-query.vitest.config.ts` |
| 기존 인계 문서 | `docs/ops/p2-02-customer-count-sort-handoff.md`, `docs/ops/p2-02-f01-f03-fix-handoff.md`, `docs/ops/p2-02-f02-recommendation-query-handoff.md` |

시작 소스 1,063개 중 기존 파일 변경은 routers와 추천 통합 테스트 2개뿐이다. `preservation-audit.json`에서 확인했다. P2-01 화면·가용성 가드·E2E, F01 RBAC, F03 테스트, DB helper, package scripts/lockfile/schema/migrations는 동일하다.

## 4. 수정 전 재현과 Golden 고정

- `pre-tie.log`: 동일 점수/생성일 입력 `[30,10,20]`에서 정책 기대 `[10,20,30]`를 위반하는 mock 회귀 **2 FAIL**. 제품 수정 전 실행했다.
- `post-tie-reproduction.log`: 같은 회귀 **2 PASS**. 이를 실제 DB 성능 증거로 표현하지 않는다.
- 제품 수정 전 실제 MySQL의 134명/500명 PRE Golden을 각각 11개 테스트로 수집했다. 시작 소스를 `pre-fix/`에 보관했다. private helper의 결과를 수집하는 별도 `pre-fix/server/rf02-probe.ts`는 원본 routers 뒤에 export 한 줄만 붙인 테스트용 사본이다.
- `pre-manifest.json`이 제품 수정 전에 `golden-134.json`, `golden-500.json`, PRE SQL, `pre-implementation.md` 해시를 고정했다. 최종 평가에서 모두 재일치했다.
- 같은 합성 fixture·사용자·input·시각 `2026-09-09T09:00:00.000Z`로 비교했다. RF02 PRE는 이미 F02 SQL 최적화가 적용된 시작 후보이며, 이전 F02의 N+1 구현을 다시 PRE로 채택하지 않았다.

## 5. 동등성 지도와 정책 결과

| 기준 | 실제 검증 | 결과 |
|---|---|---|
| G1 semantic | 134/500 fixture의 4역할 전체 후보를 ID로 맞춰 score/urgency/reasons/warnings/contactReason(s)/날짜/모든 공개 필드 및 타입 비교 | 역할별 기록 합계 **920개 동일** |
| G2 non-tie | PRE/POST 반환 후보 중 점수가 다른 모든 공통 쌍의 상대 위치 비교 | **21,192쌍 동일** |
| G3 tie policy | 제품 comparator와 독립된 oracle로 필터→정렬→limit→warnings 및 summary top5 구성 | **150개 Golden 레코드 일치** |
| 직접 공유 API | customerWarnings 기본/필터, customerContactReasons, dashboardSummary, workRhythm.summary | 의미/형태 보존 |
| INSERT 순서 | 134명 tie fixture를 서로 다른 신규 DB에 정방향/역방향 INSERT | **34개 기록 전체 동일**, SHA도 동일 |
| 반복 | 각 INSERT fixture에서 동일 member/input 실제 DB 요청 10회 | ordered IDs 동일 |
| collector/projection | 실제 synthetic full-row SQL와 최소 projection SQL 결과를 서로 다른 순서로 기존 scoring 경로에 공급 | 공개 응답 전체 동일 |

이번 rich Golden의 기존 순서는 우연히 새 정책과 일치하여 순서 변경·cutoff 교체 0건이었다. 이것만으로 결함이 없었다고 판단하지 않았다. 별도의 RED mock과 60명 완전 동점 fixture, 독립 정책 oracle, SQL projection 및 INSERT 순서 검사를 추가했다. 과거 독립 검수의 실패를 없던 것으로 표현하지 않는다.

새 tie fixture의 branch 결과 예시(합성 ID):

| limit | 정책상 ID 순서 |
|---|---|
| 1 | `60061` (85점) |
| 10 | `60061,60062,60064,60001..60007` |
| 25 | `60061,60062,60064,60001..60022` |
| 50 | `60061,60062,60064,60001..60047` |

60062는 25점, 60064는 15점 중 더 최근 생성일이다. 60001~60060은 동일 15점·동일 생성일이라 ID 오름차순이다. 같은 15점의 더 오래된 60063도 fixture에 존재한다. 0점 고객은 기존 양수 필터로 제외된다. 후보 10명인 별도 member에서 limit50은 10명을 반환한다. API의 기존 최대 limit50은 보존했으며 limit51은 BAD_REQUEST다. includeWarnings true/false × 4역할 × 1/10/25/50 및 기존 urgency/default를 검사했다.

정방향/역방향 결과 공통 SHA256: `19278742cee59208198edd05d8c61cae23b25f1b58e62b939e976f36cfea0031`.

## 6. 실제 SQL 및 RBAC

신규 task 소유 MySQL **8.4.9**, loopback `127.0.0.1:4009`, 새 datadir와 매 실행 별도 schema만 사용했다. 데이터는 고정 합성 fixture다. dotenv를 비존재 경로로 지정하고 OS 환경 allowlist, 스케줄러 비활성, 가짜 OAuth 설정으로 실행했다. 운영 DB·토큰·실제 고객·외부 발송을 사용하지 않았다. E2E의 기존 공개 폰트 CDN 요청은 가능하지만 실제 외부 업무 API를 사용하지 않는다.

| 후보 규모 | 역할 | PRE SELECT | POST SELECT | 상담 aggregate | 고객별 상담 SELECT | raw 고객 SELECT |
|---|---|---:|---:|---:|---:|---:|
| 134 | branch_admin | 5 | 5 | 1 | 0 | 0 |
| 134 | sub_branch_admin | 8 | 8 | 1 | 0 | 0 |
| 134 | team_leader | 8 | 8 | 1 | 0 | 0 |
| 134 | member | 5 | 5 | 1 | 0 | 0 |
| 500 | branch_admin | 5 | 5 | 1 | 0 | 0 |
| 500 | sub_branch_admin | 8 | 8 | 1 | 0 | 0 |
| 500 | team_leader | 8 | 8 | 1 | 0 | 0 |
| 500 | member | 5 | 5 | 1 | 0 | 0 |

계측은 actual router→Drizzle→MySQL general_log를 사용하고 계측 connection을 제외했다. 최소 고객 projection 1회·상담 group aggregate 1회·기타 3/6회 구조다. 500 확장에서 branch 범위가 실제 증가하며 subordinate fixture 규모는 동일하다. 이는 SQL statement 수의 상수 구조 증거이며 전체 계산 시간/메모리가 상수라는 주장이 아니다.

134 fixture의 역할별 허용 후보는 134/81/41/21명, 500 fixture는 500/81/41/21명이다. 고정 fixture의 독립 소유 관계 기대 집합과 전체 후보를 비교했으며 권한 밖 추천 0이었다. 조작 input의 agentId/teamId/scope 등은 범위를 넓히지 않았다. 비로그인은 UNAUTHORIZED, inactive/resigned는 FORBIDDEN이며 4개 추천 API에서 검사했다. 실제 DB와 합성 인증 context를 사용하는 router 통합 검증이며 실제 운영 로그인 검증은 아니다.

`T05/T07`만 테스트 목적으로 raw 합성 row를 조회해 공급기를 spy한다. 위 SQL 표의 운영 코드 경로는 spy 없이 실행했다. 테스트용 raw 조회를 제품 raw loading으로 혼동하지 않는다. 제품 `server/db.ts`는 시작 F02와 바이트 동일하다.

## 7. T01~T08 / C01~C12

| ID | 판정 | 근거·방식 |
|---|---|---|
| T01 | PASS | comparator 단위 + 실제 tie DB의 85/25/15점 순서 |
| T02 | PASS | 단위 + 실제 같은 15점의 신규/동일/과거 생성일 |
| T03 | PASS | mock64명 및 실제60명 동일 score/date, ID ASC |
| T04 | PASS | 실제60명 동점과 limit10/25/50 독립 기대 ID |
| T05 | PASS | actual full-row/optimized collector → 같은 comparator → 응답 동일 |
| T06 | PASS | 정/역 INSERT 별도 DB 전체 결과 비교 |
| T07 | PASS | 실제 서로 다른 SELECT projection + 단위 입력 교란 |
| T08 | PASS | 각 DB 동일 입력 10회 + 단위 10회 교란 |
| C01 | PASS | 순수 comparator key 우선순위/대칭성/동일 항목 |
| C02 | PASS | G1 전체 필드·G2 non-tie 쌍 비교 |
| C03 | PASS | T02 및 G3 |
| C04 | PASS | T03 및 G3 |
| C05 | PASS | 1/10/25/50, 후보보다 큰50, 기존51 거부 |
| C06 | PASS | T06 결과 34기록 동일 SHA |
| C07 | PASS | T08 실제 DB 반복 |
| C08 | PASS | 134/500 실제5/8 SELECT·상담1·N+1 0·raw 0 |
| C09 | PASS | 4역할 고정 ID 집합·직접 오류·scope 조작 거부 |
| C10 | PASS | PRE/POST 공유 API Golden 및 workRhythm |
| C11 | PASS | P2-01 63, P2-02 33, F01 실제 DB16, F03 B05/B07 포함 |
| C12 | PASS (최종 실행) | check/test/build·통합·관련 E2E 통과. 초기 실패와 기존 skip은 아래에 별도 기록 |

## 8. 실제 실행 명령과 결과

실제 runner는 `node C:/Users/이도현/AppData/Roaming/npm/node_modules/pnpm/bin/pnpm.cjs`이며 Node v24.15.0 / pnpm10.4.1이다. `pnpm.cmd`를 실행한 것처럼 표현하지 않는다. 아래는 해당 runner에 전달한 실제 scripts/인자다. `run.cjs`가 안전한 환경을 설정하며 `.result.json`과 로그에 정확한 args·종료 코드가 있다.

| 실제 pnpm 인자 | 최종 결과 / 로그 |
|---|---|
| `check` | exit0 / `check-complete.log` |
| `test` | **112 files, 1159 PASS**, exit0 / `test-complete.log` |
| `build` | exit0 / `build-complete.log` |
| `test --config=tests/integration/recommendation-query.vitest.config.ts` | PRE134/500 각각11 PASS, POST134_r2/500 각각11 PASS / 각 golden 로그 |
| `test --config=tests/integration/recommendation-tiebreak.vitest.config.ts` | 정방향_r2/역방향 각각 **6 PASS** / 각 tie tests 로그 |
| `test --config=tests/integration/customer-unassigned-scope.vitest.config.ts` | **16 PASS** / `f01-tests.log` |
| `test:e2e e2e/customer-list-count-sort.spec.ts e2e/customer-assign-query-state.spec.ts --workers=2 --trace=on --output=C:/work/boa-p2-02-rf02-01-20260909/p2-results` | **96 PASS** = P2-02 33 + P2-01 63 / `p2-e2e.log` |
| `test:e2e e2e/role-responsive-smoke.spec.ts --workers=1 --grep=customer\|matrix\|account --trace=on --output=C:/work/boa-p2-02-rf02-01-20260909/related-rerun-results` | **54 PASS / 21 기존 조건부 skip**, exit0 / `related-rerun.log` |
| `test --config=C:/work/boa-p2-02-rf02-01-20260909/pre-tie.config.ts` | POST mock 재현2 PASS / `post-tie-reproduction.log` |
| `db:migrate` | 각 새 소유 schema에 기존 migration만 적용, 모든 해당 로그 exit0. 새 migration 파일/DDL 변경 없음 |

표의 grep은 단일 argv의 `customer|matrix|account`이다. 셸 파이프로 실행하지 않았다. 기존 `test:e2e` script의 workers2를 명시 인자로 덮어썼다. P2 E2E는 저장소의 desktop-chromium, desktop-1280, mobile-chromium 3 projects다. F03 B05 및 B07 두 사례가 각각 3 projects에서 통과했다. 전체 unit 실행에 recommendationOrder15 및 기존 recommendations/RBAC 테스트가 포함된다. GitHub CI는 실행하지 않았다.

**실패·복구 이력도 보존한다.**

1. `post134-golden.log`: 첫 POST의 테스트 metadata가 제외 고객 2명의 DB default 생성시각까지 비교해 beforeAll 실패, 11개 테스트 미실행. 제품 후보 의미값은 원인이 아니었다. 현재 metadata는 active/non-deleted 후보만 수집하고 PRE metadata도 PRE full 후보 ID에 한정한다. 공개 API 및 scoring 필드 비교를 제거하지 않았다. 새 schema `post134_r2`로 11 PASS를 확인했다.
2. `tie-forward-tests.log`: 첫 Vitest 설정의 mergeConfig가 기본 include를 합쳐 불필요한 일반 unit까지 실제 DB 환경에서 실행했다. 6 FAIL / 1159 PASS였고 실패는 managementReports의 Invalid time value였다. 기존 설정 방식처럼 단일 include를 명시해 격리했고 새 schema `tie_forward_r2`에서 필요한6 PASS, 별도 전체 unit도1159 PASS를 확인했다. skip/assertion 완화는 없다.
3. `related-regression.log`: 첫 역할 E2E **1 FAIL / 53 PASS / 21 기존 skip**. desktop1280 member의 `/customers/assign`에서 console `Failed to fetch`를 잡았다. trace에는 직전 notifications/auth batch 요청의 `net::ERR_ABORTED`가 기록돼 있다. 서버 추천 comparator와 무관한 mock 경로이며 코드·assertion은 수정하지 않았다. 별도 단독 전체 재실행은 **54 PASS / 21 기존 skip**이다. 이 일회 실패의 재발 가능성까지 없다고 주장하지 않는다. `related-failure-analysis.json`과 원래 trace를 인계한다.

21 skip은 기존 desktop/mobile 전용 조건이며 이번에 추가하지 않았다. 미실행을 PASS 숫자에 넣지 않는다. 보조 증거 정리 스크립트의 초기 경로/데이터 형태 오류는 제품 테스트 결과에 포함하지 않았으며 최종 `equivalence-assessment.json` 생성은 모든 assertion 통과 후 완료했다.

## 9. API·DB·운영 영향 및 미검증

API 경로/input/output field·limit·warning/reason·scoring·RBAC·조직 범위·고객 분류·서버 검증·P2 UI/cache 정책은 보존했다. 의도한 동작 변화는 점수가 같은 추천의 결정적 순서와 그에 따른 cutoff뿐이다. DB schema/migration/index/runtime/dependencies/배포 설정 변경은 없다.

운영 DB/실제 고객/전화·메시지·푸시/업로드·내보내기/권한 변경/실제 배정 요청은 사용하지 않았다. synthetic auth/mock UI 증거이며 실기기와 운영 상태, 동시 데이터 변경의 완전 snapshot 일관성은 검증하지 않았다. 설치된 브라우저 viewport 에뮬레이션을 실제 휴대기기 PASS로 표현하지 않는다.

검증 후 task 소유 MySQL은 **SQL SHUTDOWN 정상 완료**, 강제 종료 없음. loopback4007/4008/4009 포트가 모두 비어 있음을 확인했다. `mysql-cleanup.json`, `ports-final.json` 참조. 새 합성 DB datadir와 build/test 산출물은 검수용 임시 자료로 남고 제품 patch에 포함하지 않는다.

## 10. 독립 재검수 인계·복귀

최종 Git 상태: staged0, tracked unstaged6, untracked18. main 원본 worktree는 clean이며 변경하지 않았다. 기존 변경을 reset/clean/stash/강제 checkout하지 않았다.

- `target-manifest.json`: 코드·테스트 후보20개와 candidate ID.
- `review-manifest.json`: 전체24개 파일 및 새 파일 내용 SHA256, staged/unstaged/untracked 구분, 증거 SHA256, 두 patch SHA256.
- `candidate-source/`: 실제 미커밋 후보 전체24개 파일 사본.
- `candidate-full.patch`: BASE_SHA 대비 P2-02/F01/F03/F02/RF02 전체 변경과 untracked 포함.
- `rf02-01-incremental.patch`: 시작 F02 후보 대비 이번8개 파일만. 기존 작업을 보존한 RF02 검토/복귀 기준이다.
- `pre-manifest.json`, `pre-fix/`, `resumed-state.json`: 시작 소스·Golden 고정 근거.
- `equivalence-assessment.json`, `preservation-audit.json`: semantic/non-tie/policy/INSERT/SQL/보존 판정.
- `pre-134-queries.json`, `pre-500-queries.json`, `post-134_r2-queries.json`, `post-500-queries.json`: 최종 실제 SQL.
- `golden-134.json`, `golden-500.json`, `post-134_r2-results.json`, `post-500-results.json`, `tie-forward_r2-results.json`, `tie-reverse-results.json`: 합성 결과 원본.
- `execution-summary.json`: 모든 실행 시도와 최종 명령의 실제 결과. `artifact-manifest.json`: 새 화면/trace 등213개 파일 해시.
- `final-verification.json`: 마지막 소스·증거·patch 해시와 Git 상태 재검증 결과.

검수자는 실행 전에 manifest의 SHA를 먼저 확인해야 한다. 두 patch는 현재 후보에 대한 `git apply --check --reverse`만 수행해 일치성을 확인했으며 실제 적용하지 않았다. RF02만 복귀하려면 시작 `pre-fix`의 routers/추천 통합 테스트를 되돌리고 이번 신규6개 파일만 제거하는 incremental 범위를 검토한다. full patch 역적용은 기존 P2 작업까지 제거하므로 RF02 복귀에 사용하지 않는다. 여기서는 복귀도 실행하지 않았다.

검수 대상 고정 후 제품·테스트·문서를 추가 수정하지 않는다. 후속 수정 시 manifest/patch/증거를 새로 생성해야 한다. 독립 검수 집중 항목은 (1) 세 정렬 key와 limit 전 적용, (2) 내부 map의 API 비노출과 모든 직접 호출부, (3) Golden oracle 독립성/동점60명 cutoff, (4) 실제5/8 SQL 및 F01 범위 보존, (5) 기록된 역할 E2E 일회 실패의 재발 여부다.
