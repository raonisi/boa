# P2-02 F02 추천 조회 구조 — 구현·자체 검증 인계

2026-09-09 Asia/Seoul. **구현 완료 / F02 자체 검증 PASS / 독립 재검수 미실시.**
P2-02 전체의 독립 수용 PASS를 선언하지 않는다. 기존 F01/F03 독립 PASS를 보존하고 이번 F02 후보를 재검수에 넘긴다. 커밋·푸시·PR·병합·배포·P2-03 작업은 실행하지 않았다.

## 1. 기준과 검수 대상

- 저장소 `C:/work/boa-p2-02`, 원격 `https://github.com/raonisi/boa.git`.
- 브랜치 `fix/p2-02-customer-count-sort`.
- BASE_SHA = HEAD = `60ea31217c8901b8f5fcb9aacee3a5fb9fbe8f83`. P2-01 및 calendar 수정이 포함된 #166 기준이다.
- 시작 후보 `39066699cdb9bcf920711cc3ed326f74d73aed6f5f19bc941a078e062df243bc`: F01/F03 검수 대상 13개 파일의 실제 해시가 모두 일치함을 확인했다.
- 새 코드·테스트 후보 ID: **`0ccc2dbabeb7ab43ea0f2ec650bb18ffd362c2691f4779ec1b3f637d91ccecfe`**.
- 증거 루트: `C:/work/boa-p2-02-f02-20260909`. 이전 검수 증거를 덮어쓰지 않았다.
- `target-manifest.json`: 문서를 제외한 코드·테스트 15개 파일의 정렬된 path/bytes/SHA-256 목록과 그 목록의 해시가 후보 ID다.
- `review-manifest.json`: 문서 포함 전체 18개 파일, staged/unstaged/untracked, 전체·증분 patch SHA-256 및 증거 해시. `candidate-source/`에 같은 바이트의 변경 파일을 보관한다.
- `candidate-full.patch`: BASE_SHA 대비 기존 P2-02/F01/F03와 이번 F02 전체. `f02-incremental.patch`: 시작 후보 대비 이번 F02만. 두 패치의 reverse apply check를 수행한다. **적용·되돌리기는 실행하지 않는다.**
- 원본 `C:/work/boa-main`은 수정하지 않았다. staged 0, 추적 unstaged 6, untracked 12. HEAD만으로는 이 미커밋 후보를 식별할 수 없다.

## 2. 정책과 탐색

사용자가 지정한 F02 마스터 문서를 실행 지시로 읽고 AGENTS.md, boa-crm-full-build, 관련 docs/ops의 RBAC·증거·테스트 정책을 적용했다. 기존 구조를 출발점으로 단일 에이전트가 작업했다. 추천 함수와 호출부를 먼저 좁혀 확인했고, Golden fixture와 기존 회귀 연결에 필요한 스키마·테스트만 한 차례 탐색 범위를 확장했다.

제품 수정 전 `equivalence-map-pre.md`를 작성했다. 원본 1,059개 소스 파일을 `pre-fix/`로 복사하고 `initial-state.json`에 해시를 기록했다. PRE_FIX 134/500 실행과 `golden-manifest.json` 고정은 제품 변경 전에 끝냈다. PRE_FIX 검증이 통과했다는 것은 기존 출력이 확보됐다는 뜻이며, 기존 N+1 구조가 수용 기준에 적합했다는 뜻은 아니다.

## 3. 수정 전 → 수정 후 데이터 흐름

PRE_FIX:

`priorityContacts → buildRecommendationItems → getScopedDashboardData → 고객 원본 전체/계약 원본/미사용 일정/최근 알림 200+COUNT/후속 → 고객마다 getConsultationsByCustomer → 기존 점수·경고·명분 → 양수·urgency → stable score DESC → limit → includeWarnings`

POST_FIX:

`같은 인증·역할·hierarchy helper → getRecommendationData → 권한 적용 고객 10필드 projection + 상담 COUNT/MAX GROUP BY + 계약 최소 batch + 후속 최소 batch + 최근 알림 200 최소 batch → 기존 점수·경고·명분 → 동일 필터·정렬·limit·응답`

추천 데이터는 5 SELECT가 필요하다. 부지점장·팀장은 기존 조직 범위 판정의 users/teams/user_permissions 3 SELECT를 포함해 총 8회다. 고객별 추가 조회, 페이지 반복 조회, 점수 계산 전 limit, 조기 후보 축소, 추천 비활성화, 캐시 우회는 없다. 후보와 관련 자료의 최소 필드 수는 데이터량에 따라 늘지만 **SQL statement 수는 고정**이다. 일정 조회와 알림 totalCount는 이 계산에서 사용되지 않아 추천 공급 경로에서 제거했다.

## 4. 추천 결과 동등성 지도

| 의존성 | 기존 의미 | POST_FIX 공급·보존 근거 |
|---|---|---|
| 권한/후보 | 지점장 전체, 부지점장·팀장 hierarchy IDs ?? [본인], 팀원 본인; active이며 미삭제 | 동일 서버 분기와 기존 buildCustomerListConditions. 새 고객 분류 조건 없음 |
| 고객 필드 | id/name/priority/tags/consultStatus/nextAction/assignedAt/createdAt, active/deleted 판정 | 10필드 projection. phone/birthDate/memo 등 원본 필드 제외 |
| 상담 | active만 조회; 기존 함수는 deletedAt를 제외하지 않음 | 같은 조건 COUNT와 MAX(createdAt). active+deleted fixture 포함. 상담 내용 SELECT 없음 |
| 계약 | 해당 담당 범위, active, 미삭제. createdAt DESC 뒤 stable (contractDate ?? createdAt) DESC | customerId/contractDate/createdAt/active/deleted 최소 batch. 최신 contractDate=NULL이 옛 계약 날짜를 가리는 의미 보존. 해지/실효를 임의로 제외하지 않음 |
| 후속 | 해당 담당 범위, 미삭제, scheduled/postponed, nextContactDate ASC | customerId/status/nextContactDate batch. overdue/today/openCount/다음 날짜 계산 그대로 |
| 알림 | 해당 사용자 범위, dueAt가 NULL 또는 실제 now 이하인 최근 200건 **먼저 선택** | 4필드 batch. 이후 unread 또는 processStatus 미확인, customer 관련 판정. 무관한 알림도 200건 창을 차지하며 과거 알림을 새로 포함하지 않음 |
| 점수·경고 | 기존 7/14/90일, 계약 관리, 태그/등급/nextAction/후속/알림 정책 | 기존 scorer 재사용. 상담 배열 길이→count, 최신 row.createdAt→MAX 값만 치환 |
| 명분 | 기존 문구, Set 삽입 순서, 첫 contactReason와 reasons 상위 5 | buildSafeContactReason과 응답 구성 유지 |
| 시간 | KST day start/end, assignedAt 우선. 알림 due의 now는 input.date와 별개 | 테스트만 Date를 `2026-09-09T09:00:00.000Z`로 고정. 운영 시계·런타임 설정 불변 |
| 정렬/동점 | 조회 createdAt DESC, 점수 DESC의 stable sort | 새 tie-break 없음. 동일 점수 및 동일 createdAt 고객의 PRE/POST 실제 순서 비교 |
| limit | 기존 1..50/default10, 양수·urgency·정렬 후 slice | 1/10/50 × warnings true/false × 4역할. 후보보다 큰 50은 팀장41/팀원21에 적용. 51은 BAD_REQUEST. 지점장134/500 전체 초과 limit은 기존 API가 지원하지 않음 |
| API | rank 필드는 없고 배열 위치가 순위 | 필드·타입·날짜 직렬화까지 전체 SuperJSON 응답 비교. 비교에서 제외한 값 없음 |

`getScopedDashboardData` 자체와 다른 소비 경로는 그대로다. `buildWorkRhythmReport`의 추천 계산은 새 공급 경로를 사용하며 전체 응답 Golden 비교를 했다. workRhythm이 별도로 수행하는 기간 집계의 원본/상담 조회까지 최적화한 것으로 주장하지 않는다.

직접 소비 경로는 recommendations 4 API와 workRhythm 내부 추천 호출이다. 고객 목록 `customerListQueries.ts`, `TodayWorkSection.tsx`, `CustomerDetail.tsx`는 변경하지 않았다. 네 API의 shape/default/권한/빈 응답/오류 전파를 실제 DB 비교와 단위 테스트로 나눠 검증했다. customerContactReasons의 빈 사실 자료는 기존 general_check fallback을 유지한다.

## 5. 실제 MySQL 계측과 Golden

새 소유 MySQL 8.4.9, `127.0.0.1:3999`, `mysql-data/` 전용 datadir와 `boa_f02_*`, `boa_f01_f02_regression` 스키마만 사용했다. @@datadir/@@port/소유 manifest를 검사하고 빈 DB에 기존 migration·합성 fixture를 적용했다. 운영 DB와 외부 서비스는 연결하지 않았다.

테스트 후 SQL SHUTDOWN 요청이 끝나지 않아 datadir·포트·실행 경로·명령 인자·부모 PID를 대조했다. Windows MySQL의 생성된 monitor와 그 자식 인스턴스임을 확인한 뒤 **이 테스트 프로세스 트리만 강제 종료**했다. 일반 종료를 성공했다고 기록하지 않는다. `mysql-cleanup.json`, `ports-final.json`에 근거가 있으며 테스트 서버3987/3988과 MySQL3999 포트는 모두 닫혔다. 테스트 실행 결과와 데이터 파일은 보존했다.

MySQL general_log에서 해당 실제 라우터 호출 동안 발생한 SELECT를 수집했다. 계측 연결 자체는 제외했고 DB 테스트는 순차 실행했다. 입력은 같은 date/limit=50/includeWarnings=true, 사용자·fixture·고정 시각 모두 동일하다. SQL 원문은 아래 JSON 증거에 있다.

| fixture | 역할 | 허용 후보 | PRE 총 SELECT | POST 총 SELECT | PRE 상담 SELECT | POST 상담 aggregate | 반환 |
|---|---|---:|---:|---:|---:|---:|---:|
| 134 | branch_admin | 134 | 140 | 5 | 134 | 1 | 50 |
| 134 | sub_branch_admin | 81 | 93 | 8 | 81 | 1 | 50 |
| 134 | team_leader | 41 | 53 | 8 | 41 | 1 | 41 |
| 134 | member | 21 | 27 | 5 | 21 | 1 | 21 |
| 500 | branch_admin | 500 | 506 | 5 | 500 | 1 | 50 |
| 500 | sub_branch_admin | 81 | 93 | 8 | 81 | 1 | 50 |
| 500 | team_leader | 41 | 53 | 8 | 41 | 1 | 41 |
| 500 | member | 21 | 27 | 5 | 21 | 1 | 21 |

각 호출 고객 SELECT는 PRE/POST 모두 1회지만 POST는 최소 projection이다. 상담 외 기타 SELECT는 지점장·팀원 5→3, 부지점장·팀장 11→6이다. full raw customer SELECT 1→0, 고객별 상담 SELECT N+1은 N→0이며 그룹 집계 1회가 남는다. 확장 fixture는 지점장 후보가 134→500으로 증가하고 하위 세 역할의 후보 수는 유지되는 분포다.

권한 밖 추천 0건. 네 역할의 허용 ID 집합은 구현 helper가 아닌 fixture의 독립 규칙으로 검증했다. 비로그인/inactive/resigned는 4 API 모두 기존 UNAUTHORIZED/FORBIDDEN, 권한 밖 상세/경고 대상은 FORBIDDEN. 임의 agentId/teamId/scope 등 미지원 입력은 기존 Zod 동작으로 범위를 넓히지 못한다. 실제 HTTP 로그인/쿠키 검사가 아니라 **합성 인증 context + 실제 router middleware + 실제 MySQL** 검증이다.

PRE/POST 각각 11개 통합 테스트. 134와 500의 각 62개 응답 묶음, 총 124개 Golden이 바이트 해시까지 동일했다.

- 134 PRE = POST SHA-256: `9460b1c75b2a48af9b5626a2fe4bfd956bfcb0ff0b3101a35533163212031dfe`
- 500 PRE = POST SHA-256: `11a219572e9a07ec938a4132df1ad66a67cf8ba91b16a9a549119f3562ae6500`
- `golden-134.json`, `golden-500.json`, `golden-manifest.json`, `equivalence-results.json`
- `pre-134-queries.json`, `pre-500-queries.json`, `post-134_r3-queries.json`, `post-500-queries.json`
- `post-134_r3-results.json`, `post-500-results.json`

합성 fixture에는 상담 0/1/복수, active+deleted 및 inactive 상담, inactive/삭제 고객, 계약 NULL 날짜/해지·실효 상태, 후속 중복·상태/KST 경계, 200건 창 밖·미도래 알림, 동점, 오래된 뒤쪽 ID의 최고 점수를 포함했다.

## 6. F02-01~12 자체 판정

| ID | 판정 | 실행 근거 |
|---|---|---|
| F02-01 | PASS | 수정 전 실제 DB 134명 상담134/총140 및 500명 상담500/총506 재계측 |
| F02-02 | PASS | 134명 62개 Golden 응답 전체 deep equality 및 SHA 동일 |
| F02-03 | PASS | 4역할 limit1/10/50, 후보 초과50, API 최대 초과51 거부; 조기 limit 없음 |
| F02-04 | PASS | warnings true/false 모든 역할·limit 비교, 공개 경고·명분 전체 동일 |
| F02-05 | PASS | 동일 점수·동일 createdAt fixture의 배열 순서 동일 |
| F02-06 | PASS | 4역할 독립 허용 ID 집합 및 권한 밖 추천0 |
| F02-07 | PASS | 비로그인/inactive/resigned 4API 거부, 입력 조작 범위 확대0 |
| F02-08 | PASS | 실제 SQL: 고정5 또는 권한 포함8, per-customer 상담 SELECT0, 원본 고객 조회0 |
| F02-09 | PASS | 500명 62개 Golden 동일, 지점장 506→5 SELECT |
| F02-10 | PASS | 4API + workRhythm Golden, 기존 crm 회귀 및 새 빈 응답·오류 전파 테스트 |
| F02-11 | PASS | P2-01 63/63 + P2-02 33/33 E2E; F01 실제 DB16/16; F03 테스트 바이트 보존 |
| F02-12 | PASS | 아래 실제 check/test/build 및 관련 E2E 결과 |

독립 검수는 미실시다. 과거 CI나 검수 숫자를 현재 실행 결과로 재사용하지 않았다.

## 7. 실제 명령과 결과

Windows PowerShell 실행 제약을 피해 CMD에서 `node C:/work/boa-p2-02-f02-20260909/run.cjs <label> <pnpm 인자>`를 실행했다. 이 도구는 설치된 **pnpm 10.4.1 CLI를 Node 24.15.0으로 직접 실행**한다. `pnpm.cmd`를 실행했다고 표현하지 않는다. 정확한 자식 명령, cwd, 종료값은 각 `.log`/`.result.json`과 `execution-summary.json`에 있다. 환경은 OS allowlist, dotenv 미로드, DB 기본 빈 값, 외부 발송·scheduler 비활성이다.

| 최종 label | 실제 pnpm 인자 | 결과 |
|---|---|---|
| check-complete | `check` | exit0, tsc --noEmit |
| unit-complete | `test` | exit0, 111 files / **1144 tests PASS**, recommendations·RBAC 포함 |
| build-complete | `build` | exit0, Vite + esbuild |
| pre134-golden / pre500-golden | `test --config=tests/integration/recommendation-query.vitest.config.ts` | 각각11 PASS, 수정 전 사본 |
| post134-r3-golden / post500-golden | 동일 통합 명령 | 각각11 PASS, 실제 MySQL/Golden/SQL |
| f01-tests | `test --config=tests/integration/customer-unassigned-scope.vitest.config.ts` | **16 PASS**, 실제 MySQL |
| p2-e2e | `test:e2e e2e/customer-list-count-sort.spec.ts e2e/customer-assign-query-state.spec.ts --workers=2` | **96 PASS**, desktop-chromium/desktop-1280/mobile-chromium |
| related-regression | `test:e2e e2e/role-responsive-smoke.spec.ts --workers=1 --grep=customer\|matrix\|account --output=C:/work/boa-p2-02-f02-20260909/related-results` | **54 PASS / 기존 조건부 skip21**. 실제 regex 인자는 shell 없이 전달 |

모든 격리 스키마의 `db:migrate`도 exit0. schema/migration 파일을 수정한 것은 아니다. related 실행은 `related.cjs`가 pipe 문자를 shell 해석 없이 전달했다. 21개 기존 skip은 통과로 세지 않았으며 assertion·skip 조건을 변경하지 않았다. 1440/390/320 CSS px 검증은 P2-02 B11 및 P2-01 A10에 포함된다.

개발 중 실패 기록도 남겼다. `check-first`는 이전 변수 latestConsultation의 반환 참조가 남아 실패했고 `post134-golden`은 그 오류로 10실패/1통과였다. 참조 수정 후 `post134-r2-golden`은 새 계측 검사가 기존 조직 권한 users 조회의 필드까지 고객 projection 금지 검사에 포함해 2실패/9통과였다. 고객 추천 5개 조회의 projection 검사와 전체 SQL5/8 개수 검사를 분리해 정정했다. 기존 보안 검사나 테스트를 약화한 것이 아니며, 최종 r3/500은 모두 통과했다. 실패 시도는 별도 스키마·로그·결과로 보존했다.

마지막으로 빈 응답 회귀를 추가해 단위 테스트가 1143→1144가 되었다. 이전 `target-manifest-v1.json`은 최종 후보가 아니다. 이후 check/test/build를 다시 실행하고 새 target manifest를 고정했다. 이후 제품 변경 없음.

## 8. 변경 파일과 보존

이번 F02 제품 변경 **2개**:

- `server/db.ts`: 기존 권한 조건을 사용하는 추천 전용 최소 projection/상담 aggregate/관련 batch5개.
- `server/routers.ts`: 동일 역할 범위로 추천 자료 공급 교체, 상담 count/latest fact 연결. scoring/warning/reason/최종 limit API 유지.

이번 테스트 변경 **4개**:

- `server/crm.test.ts`: 기존 추천·workRhythm fixture를 새 자료 경계에 연결. 기존 assertion 유지, raw/N+1 fallback 금지 및 4API 빈 응답·오류 전파 추가.
- `tests/integration/recommendation-query.fixture.ts`: 순수 합성 고정 fixture와 독립 역할 기대 ID 집합.
- `tests/integration/recommendation-query.mysql.test.ts`: 소유 DB 확인, 실제 PRE/POST router Golden과 SQL 계측·역할/limit/공유 API 검사.
- `tests/integration/recommendation-query.vitest.config.ts`: 명시적으로 실행하는 실제 DB suite 설정.

문서 변경 **1개**: 이 파일.

이번에 변경하지 않고 그대로 인계하는 기존 변경 파일 11개: `client/src/pages/CustomerList.tsx`, `client/src/lib/customerListQueries.ts`, `e2e/fixtures/mock-trpc.ts`, `e2e/customer-list-count-sort.spec.ts`, `e2e/fixtures/customer-list-counts.ts`, `server/customer-list-counts.test.ts`, `server/customers.scope-filter.test.ts`, `tests/integration/customer-unassigned-scope.mysql.test.ts`, `tests/integration/customer-unassigned-scope.vitest.config.ts`, `docs/ops/p2-02-customer-count-sort-handoff.md`, `docs/ops/p2-02-f01-f03-fix-handoff.md`.

초기 1059개 파일 중 db.ts/routers.ts/crm.test.ts 외 1056개는 바이트 동일하다. `preservation-audit.json`은 F01 customer condition builder, 기존 dashboard helper, P2-02 list 입력/권한 resolver 구간의 동일성도 확인한다. P2-01 화면·availability·E2E는 BASE 대비 변경 없음.

API 입력·응답 계약, RBAC 정책, 고객 분류, DB schema/migration/index, 의존성·package scripts·런타임·배포 설정은 변경하지 않았다. 신규 getRecommendationData는 내부 DB helper이며 외부 API가 아니다.

## 9. 증거·제한·재검수

`p2-results/`와 `artifact-manifest.json`에 새 합성 화면 캡처 36개 및 실행 상태 파일을 보관했다. SQL/Golden/화면/로그는 합성 데이터만 포함하며 실제 고객정보·토큰·.env 값은 포함하지 않는다. 테스트 DB와 빌드 산출물, node_modules, 임시 실행 도구는 제품 patch에 포함하지 않는다.

재검수자는 먼저 target/review manifest와 현재 파일 해시, 전체/증분 patch를 대조한다. fixture 재실행은 새 소유 DB와 기존 migrations, BOA_F02_PHASE/SIZE/ROOT/EVIDENCE/OWNER 환경을 명시적으로 사용한다. PRE root는 고정 pre-fix 사본, POST root는 candidate-source 적용 후 전체 소스다. 이미 생성된 Golden을 덮어쓰지 말고 새 증거 디렉터리를 사용한다. 실패 시도별 재실행은 별도 `_rN` 스키마를 사용했다. 재검수 자체가 합성 fixture 쓰기를 수행해야 하는 경우 읽기 전용 검수와 구분한다.

남은 확인 항목:

1. **독립 재검수 미실시**: 특히 기존 알림200건 창과 active+deleted 상담 의미 보존을 검토할 것.
2. SQL 동점의 기존 추가 순서 보장은 없다. 동일 DB·fixture에서 실제 동점 순서가 일치함을 검증했으며 새 정렬 정책은 추가하지 않았다.
3. SQL 수가 고정인 것과 DB 실행시간/메모리가 상수인 것은 다르다. 전체 허용 후보의 최소 fact 계산은 유지한다. 1,000명/운영 부하/동시 데이터 변경 스냅샷은 검사하지 않았다.
4. 브라우저는 합성 mock, 서버 집계·추천·권한은 격리 실제 MySQL로 별도 검증했다. 실기기·운영 로그인·GitHub CI·운영 배포는 이번 범위 밖이다.
5. workRhythm 등 다른 기능의 독립적인 조회 구조는 이번 추천 F02 최적화 완료 범위에 포함하지 않는다.

복귀가 필요하면 후보 해시와 추가 사용자 변경 유무를 확인한 뒤 **F02 증분 patch만** 검토하여 되돌린다. 전체 reset/clean/stash 또는 이전 P2-02/F01/F03 변경 제거는 하지 않는다. 후보 파일이 바뀌면 manifest·patch·검증 근거를 새로 만들고 이 후보의 PASS를 재사용하지 않는다.
