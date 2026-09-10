# P2-02 F01/F03 수정 · 독립 재검수 인계

작업: FIX-P2-02-F01-F03-01 · 2026-09-08 Asia/Seoul. 구현자의 자체 검증이며 독립 재검수는 미실시다.

## 판정과 범위

- F01: 실제 라우터·격리 MySQL 및 SQL 구성 검사에서 수정 전 실패와 수정 후 통과를 확인했다.
- F03: PASS(로컬 세 프로젝트). 제출 E2E의 데스크톱 전용 가정을 실제 모바일 카드 검사로 수정했고 P2-02 33/33·P2-01 63/63이 통과했다.
- **F02는 미수정·미해결이다. B10 및 P2-02 전체 판정은 FAIL로 유지한다.** 추천 점수·선정 정책·무제한 원본/N+1 조회를 바꾸거나 완료 처리하지 않았다.
- 제품 수정은 `server/db.ts` 1개 파일, 기존 scope OR 표현을 보존한 미배정 AND 조건 1개다. API 계약, 권한 정책, 분류, 집계·정렬·캐시 UI, P2-01 UI는 변경하지 않았다.
- 커밋·푸시·PR 생성·병합·배포·운영 설정 변경은 실행하지 않았다. 운영 반영 여부나 Production safe를 주장하지 않는다.

## 기준과 동일성

| 항목 | 확인값 |
|---|---|
| 저장소 | `https://github.com/raonisi/boa.git` |
| 작업 공간 | `C:/work/boa-p2-02` |
| 브랜치 | `fix/p2-02-customer-count-sort` |
| BASE_SHA = HEAD | `60ea31217c8901b8f5fcb9aacee3a5fb9fbe8f83` |
| 기준 제목 | `fix: handle assignment query failures and calendar date contrast (#166)` |
| 이전 후보 ID | `5403604eb172877426d94ad5890d0e30346da38823b1502f97d6fd88850ce85b` |
| 이전 패치 SHA-256 | `bb69f20b40160c76c3ca74165b9a42eb0835c962e3e152b8faf5a66fd81cfe8c` |
| 새 제품·테스트 후보 ID | `39066699cdb9bcf920711cc3ed326f74d73aed6f5f19bc941a078e062df243bc` |

시작 때 이전 manifest의 10개 파일 해시와 패치 해시가 모두 일치했다. 기존 변경을 복원·덮어쓰기·stash하지 않고 같은 전용 브랜치의 미커밋 후보에 좁은 수정만 더했다. 원본 `C:/work/boa-main`은 main, HEAD `0d87e5cd81278dcf3f15cce7a3d6aace0fd6e6af`, clean이며 수정하지 않았다. 과거 감사 HEAD를 작업 기준으로 사용하지 않았다. P2-01은 현 BASE의 PR #166 병합 제목·파일 포함과 이번 회귀 실행으로 확인했다.

읽은 실행 지시서: `C:/Users/이도현/Downloads/01_F01_F03_Targeted_Fix.md`. 실제 독립 보고서: `C:/work/boa-p2-02-audit-20260908-AqQX0C/REPORT.md` 및 MySQL v2 fixture/facts, 모바일 실패 증거. 지시서가 열거한 별도 `BOA_P2-02_Audit_Report_20260908.md`, `BOA_P2-02_Codex_Implementation_Master_20260908.md`, `BOA_P2-02_Codex_ReadOnly_Audit_Master_20260908.md`는 Downloads와 해당 증거 루트에서 발견되지 않아 그 파일명 원문과의 대조는 미검증이다. 실제 REPORT의 후보 식별·F01/F02/F03 내용과 이번 지시서는 대조했다.

적용한 정책: 루트 AGENTS.md, boa-crm-full-build SKILL.md, docs/ops의 codex-workflow, rbac-safety, evidence-based-qa-standard, e2e-playwright-standard. 이미 식별된 심볼과 직접 호출부 10개 파일 이내·검색 8회 이내의 제한 탐색으로 확인했다. 테스트 설정·정책·외부 검수 증거 읽기는 제품 재감사로 확장하지 않았다.

## 원인과 수정

### F01 — 기존 권한 결함

`buildCustomerListConditions`가 `agentIds → agentId → unassigned → teamId → subBranchAdminId` 순서의 else-if였으므로 미배정 입력에서 조직 조건 자체가 빠졌다. `customers.list`와 `customers.segmentCounts`는 서버의 `resolveCustomerListScopeFilter` 결과를 전달했지만 DB helper가 그 범위를 잃었다. BASE에도 존재했던 결함이며 P2-02가 만든 새 회귀로 분류하지 않는다.

수정은 scope 선택의 기존 OR 구조를 유지하고 그 뒤에 `if (filter.unassigned) ... agentId IS NULL`을 AND 조건으로 추가하는 것이다. 직접 담당·하위 담당·팀/부지점장 소속의 합집합을 임의 교집합으로 바꾸지 않았다. 충돌하는 담당자/미배정은 교집합 0건, 빈 허용 ID 배열은 false로 유지한다. 팀 없는 팀장도 기존 hierarchy fallback 범위에만 머문다. 클라이언트 조직 필드는 여전히 권한 근거가 아니다.

| 실제 라우터 입력 | 수정 전 합성 ID / all·database | 수정 후 합성 ID / all·database |
|---|---|---|
| actor 2 부지점장, `unassigned:true` | `[47001,47002,47003,47004]` / 4·4 | `[47001,47003]` / 2·2 |
| actor 3 팀장, `unassigned:true` | `[47001,47002,47003,47004]` / 4·4 | `[47003]` / 1·1 |

47001은 A 부지점장 풀, 47003은 A 팀10, 47002는 B 부지점장 풀, 47004는 조직 미지정이다. 추가 합성 담당 고객으로 기존 scope OR의 자기 담당·하위 담당을 검사했다. 기대 ID와 건수는 fixture에서 독립적으로 고정했으며 집계 구현을 정답 함수로 호출하지 않는다. 48002의 계약 2개는 계약 고객 1명으로 유지한다.

검사 계층:

- 실제 appRouter·activeUserProcedure·범위 resolver·Drizzle·mysql2·MySQL 8.4.9 실행. **auth context만 주입했으며 실제 로그인·쿠키·HTTP 세션 검증은 아니다.**
- 네 활성 역할 및 팀 미지정 팀장의 정상/미배정 absent·false·true, 검색·업무·분류·상충 담당자 조건, 타 조직/ID 조작, 비로그인·inactive·resigned 거부를 확인했다.
- `quickCounts` 라우터에는 미배정 입력이 없다. 종전 독립 감사에서 quickCounts 우회가 재현됐다고 주장하지 않는다. 이번에는 정상 라우터 총량/조직 입력 조작과 직접 helper의 scope AND 조건을 각각 검사했다.
- SQL 구성 검사에서는 목록·segmentCounts·직접 quickCounts helper가 team/sub-branch/agent/agentIds/빈 ID 범위를 보존함을 확인한다. 이 검사를 실제 DB 실행 증거로 혼동하지 않는다.

### F03 — 신규 테스트 결함

기존 모바일은 `useIsMobile`의 768px 미만 조건에서 table URL을 카드로 정규화한다. 제품 동작은 유지하고 테스트만 이 실제 경계로 분기했다. 존재 여부에 따라 assertion을 생략하는 locator는 쓰지 않았다.

- B05: 데스크톱 `[role=row][data-customer-id]`, 모바일 `customer-list-result-card`를 검사한다. 네 정렬마다 독립 ID 20개의 표시 순서·첫 고객명·서버 요청 sort·안내·총량83을 모두 확인한다. 모바일 table URL 해제도 확인한다.
- B07: 고객명순으로 전환해 이전 계정의 고객93001을 확실히 선택한다. 데스크톱은 기존 전체 선택20명, 모바일은 실제 카드 checkbox로1명 선택·checked를 확인한다. 계정/역할 전환 후 고객93001의 ID/이름, 선택 안내, checked 상태, 이전 내담당 배지가 사라지고 허용 ID·DB40명·계약20명까지 검사한다.
- 기존 지연 응답 역전 단계, 생성 후 invalidation 검사, viewport 검사, 총 테스트 수를 보존했다. skip·assertion 제거·baseline 완화·fixture 축소·추가 sleep/timeout으로 통과시키지 않았다.

## 전체 변경 파일

이 표는 BASE 대비 미커밋 변경 전체다. “이번”은 이전 독립 검수 후보 대비 증분이다.

| 구분 | 파일 | 이유 / 이번 변경 |
|---|---|---|
| 제품 | `server/db.ts` | P2-02 공유 조건/SQL 집계 보존 + **이번 F01 미배정 AND** |
| 제품 | `server/routers.ts` | 기존 P2-02 목록/집계 scope 공통화. 이번 변경 없음 |
| 제품 | `client/src/lib/customerListQueries.ts` | 기존 P2-02 조회/캐시/집계 연결. 이번 변경 없음 |
| 제품 | `client/src/pages/CustomerList.tsx` | 기존 P2-02 총량·배지·정렬 표시. 이번 변경 없음 |
| 테스트 | `server/customer-list-counts.test.ts` | 기존 검사 보존 + 이번 공통 helper scope 교집합5개 |
| 테스트 | `e2e/customer-list-count-sort.spec.ts` | 이번 F03 B05/B07 실제 모바일 경로 보완 |
| 테스트 | `tests/integration/customer-unassigned-scope.mysql.test.ts` | 이번 실제 MySQL·라우터 권한 회귀16개 |
| 테스트 설정 | `tests/integration/customer-unassigned-scope.vitest.config.ts` | 실제 DB 검사의 명시적 별도 실행. 기본 단위 테스트의 DB 연결 방지 |
| 테스트 | `server/customers.scope-filter.test.ts` | 기존 P2-02 역할/입력 검사. 이번 변경 없음 |
| 테스트 | `e2e/fixtures/mock-trpc.ts` | 기존 mock 입력 전달. 이번 변경 없음 |
| 테스트 | `e2e/fixtures/customer-list-counts.ts` | 기존 합성123명 fixture. 이번 변경 없음 |
| 문서 | `docs/ops/p2-02-customer-count-sort-handoff.md` | 이전 보고서 그대로 보존. 현재 판정은 이 새 보고서를 참고 |
| 문서 | `docs/ops/p2-02-f01-f03-fix-handoff.md` | 이번 인계·검증·잔여 F02 기록 |

이번 증분은 제품1 + 테스트/설정4 + 문서1, BASE 대비 전체는 제품4 + 테스트/설정7 + 문서2 = 13파일이다.

## 실제 실행과 증거

새 증거 루트: `C:/work/boa-p2-02-f01-f03-20260908`. 과거 구현/독립 검수 증거를 덮어쓰지 않았다. `run.cjs`가 OS 환경 allowlist만 상속해 실제 `pnpm.cmd`를 실행한다. `.env` 파일 부재 확인, DB URL 기본 빈 값, 합성 OAuth, scheduler 비활성화, 전용 E2E localhost:3787(관련 역할 회귀는3788)이다. Windows Node 24.15.0 / pnpm 10.4.1.

MySQL은 이번에 새로 생성한 `mysql-data`, localhost:3799의 자체 인스턴스다. 시작 전 포트와 폴더가 비어 있음을 확인하고 @@datadir/@@port를 실제 대조했다. `boa_f01_mysql_before`와 `boa_f01_mysql_after` 두 새 DB에 저장소의 기존 마이그레이션만 적용했다. 테스트 자체도 ownership marker·localhost·DB 이름·빈 users/customers를 검사한 뒤 합성 데이터를 넣는다. 기존 3307/과거3699/운영 DB에 접속하지 않았다. 종료 시 자기 인스턴스만 SHUTDOWN했고 데이터 폴더는 증거로 남겼다. DB 파일·생성된 내부 인증 재료를 코드 패치나 인계 manifest에 포함하지 않는다.

명령은 아래와 같으며 각 로그 첫줄 및 `.result.json`에 실제 인자·종료 코드를 남겼다. 통합 테스트는 기본 `pnpm.cmd test`에 자동 포함되지 않고 명시적 config와 소유 확인 환경이 있어야 실행된다. skip 처리하지 않는다.

| 로그 | 실제 pnpm.cmd 인자 | 결과 |
|---|---|---|
| `mysql-before-migration-corrected.log`, `mysql-after-migrate.log` | `db:migrate` | 각 exit0, 기존 migration을 새 합성 DB에 적용 |
| `mysql-before-test.log` | `test --config=tests/integration/customer-unassigned-scope.vitest.config.ts` | 8통과/8실패, exit1. F01 before ID/count 증거 |
| `mysql-after-test.log` | 같은 통합 검사 | **16/16 통과**, exit0 |
| `sql-before.log` | `test server/customer-list-counts.test.ts` | 12통과/5실패, exit1. 추가 F01 회귀5개 실패 |
| `sql-after.log` | `test server/customer-list-counts.test.ts server/customers.scope-filter.test.ts` | **32/32 통과**, exit0 |
| `f03-before-mobile.log` | `test:e2e e2e/customer-list-count-sort.spec.ts --project=mobile-chromium --workers=1 --output=<새 증거>/f03-before-mobile-results` | **9통과/2실패**, exit1. 원 B05/B07 동일 실패 |
| `check-first.log`, `check-final.log` | `check` | 각 exit0 |
| `unit-candidate.log` | `test` | **111파일·1,142/1,142 통과**, exit0 |
| `build-candidate.log` | `build` | exit0 |
| `p202-p201-candidate.log` | `test:e2e e2e/customer-list-count-sort.spec.ts e2e/customer-assign-query-state.spec.ts --workers=1 --output=<새 증거>/candidate-browser-results` | **96/96 통과**, skip0, exit0 |
| `related-customers.log` | `test:e2e:roles --workers=1 --grep=customer --output=<새 증거>/related-customers-results` | **32통과/기존13skip**, exit0 |
| `related-role-matrix.log` | `test:e2e:roles --workers=1 --grep=matrix --output=<새 증거>/related-role-matrix-results` | **12/12 통과**, exit0 |
| `related-accounts.log` | `test:e2e:roles --workers=1 --grep=account --output=<새 증거>/related-accounts-results` | **10통과/기존8skip**, exit0 |

관련 회귀 합계는 **54통과/기존21skip/실패0**이다. skip은 저장소에 이미 있던 데스크톱·모바일 적용 조건이며 변경/추가하지 않았다. 통과로 계산하지 않는다. 세 프로젝트 이름은 desktop-chromium(1440×900), desktop-1280(1280×800), mobile-chromium(Pixel5)이고, B11의 별도 viewport는1440×900·390×844·320×740이다. 이 세 크기의 숫자·정렬·키보드 접근/가로 넘침 검사가 통과했고 count-sort-controls 캡처를 직접 시각 확인했다. `screenshots-manifest.json`과 `execution-summary.json`에 이미지 해시와 프로젝트/파일별 실제 실행 수를 남겼다.

실행 준비 오류도 보존했다. `mysql-before-migrate.log`는 외부 runner의 DB 이름 접미사 오류로 존재하지 않는 합성 DB를 지정해 exit1, 실제 DB 작업 이전 실패다. runner만 고쳐 원래의 새 DB에 마이그레이션을 성공시켰다. `f03-before.log`는 grep 인자 오류로 No tests found/exit1이며 재현 성공으로 세지 않았다. 이후 제출된 모바일 spec 전체를 실제 실행한 `f03-before-mobile.log`가 수정 전 재현이다. 제품 assertion을 바꿔 이 오류를 숨기지 않았다.

### 수용 항목 판정

| 항목 | 자체 판정 | 방식·한계 |
|---|---|---|
| B08/B09 · F01 | PASS(실행 범위) | 실제 라우터·MySQL16개 및 SQL/기존 scope32개. 인증 context 주입; 실제 로그인 HTTP 미검증 |
| B05/B07 · F03 | PASS(로컬 mock) | 원 B05/B07 각각3프로젝트 통과. 모바일 네 정렬·카드 선택 후 계정/분류 전환까지 완료 |
| B12 · P2-01 | PASS(로컬 회귀) | 기존 A01–A10, 21개×3프로젝트 **63/63** 통과. 실제 배정 저장 검사는 아님 |
| B10 · F02 | **FAIL 유지** | 이전 실제 MySQL 계측: 응답50 전 LIMIT 없는 고객 SELECT1 + 상담 SELECT134. 이번 재계측/수정 없음 |

P2-02 빠른 필터/집계/정렬의 나머지 정의는 기존 인계 및 실제 독립 REPORT를 유지한다. 기존 검수의 일반 통과를 F01 수정 이후 전체 독립 PASS로 옮겨 적지 않는다. 이번 실행의 P2-02 spec은 B02/B03/B04/B05/B06/B07/B11/B01로 11개, P2-01은21개이며 세 프로젝트 합계96개다. 테스트 분할이나 수 축소는 없다.

## 후보 고정과 재검수 방법

- `target-manifest.json`: BASE/HEAD/브랜치 및 **제품·테스트11파일만**의 정렬된 `{path,bytes,sha256}` 목록. 이 배열의 `JSON.stringify` SHA-256이 새 후보 ID다. 보고서와 메타데이터를 제외해 자기 참조 해시를 피한다. 이전 ID는 문서도 포함했던 방식이므로 두 ID 자체의 비교 대신 initial-state의10개 파일 해시 대조를 사용한다.
- `review-manifest.json`: 문서까지 **전체13파일**, staged/unstaged/untracked, 제품·테스트 manifest 해시, 전체/증분 패치 해시, 실행 결과 파일 해시. 이 파일 자체는 자신의 hash 목록에 포함하지 않는다.
- `candidate-full.patch`: BASE 대비 기존 P2-02 미커밋 변경과 이번 변경·새 파일을 모두 포함한다.
- `f01-f03-incremental.patch`: 이전 `candidate-source`의 정확한 바이트 사본 대비 이번6파일 차이만 포함한다. 새 통합 검사/문서도 포함한다.
- `candidate-source/`: 위13개 의도된 파일의 고정 사본. 비밀·환경·DB 파일 제외.
- 두 패치는 현재 후보에서 `git apply --check --reverse`로 구조를 검증한다. 검수자는 안전한 별도 BASE 사본에 전체 패치를 적용한 뒤 `candidate-source/`의13파일을 바이트 그대로 사용해 파일 해시를 대조한다. Git의 Windows 줄끝 정규화와 혼합 줄끝이 있으므로 바이트 동일성의 기준은 이 고정 사본이다. 현재 사용자의 작업 공간에 patch를 중복 적용하거나 reset하지 않는다.
- 화면/trace는 `f03-before-mobile-results/`와 `candidate-browser-results/`. 숫자·정렬·키보드/overflow 캡처에는 합성 고객만 있다. facts JSON도 합성 ID·수만 기록한다.

최종 고정 이후 같은 파일을 계속 수정하지 않는다. 변경이 생기면 manifest/patch/증거를 다시 만들고 이전 PASS를 자동 재사용하지 않는다. 현재 staged는 없으며 추적5파일 unstaged, 비추적8파일이다. 임시 runner·MySQL·빌드 산출물은 의도된 코드 변경과 구분되며 패치에 포함하지 않는다.

## 남은 사항과 복귀

1. **F02/B10 확정 실패 유지**: 추천의 전체 원본/N+1 조회는 별도 승인 범위에서 해결해야 한다.
2. F01/F03 새 후보에 대한 별도 읽기 전용 독립 재검수는 아직 하지 않았다.
3. 실제 로그인·쿠키·HTTP 세션, 운영 코드/DB/배포 상태, 실제 저장·배정·외부 발송은 검증하지 않았다.
4. Chromium CSS viewport 증거이며 Android/iOS 실기기·소프트 키보드·보조기술 전체 검증은 아니다.
5. 일반 고객 범위/선택 전환을 넘어선 전체 성능·부하·모든 UI/접근성 CI는 이번 범위에서 재실행하지 않았다.

복귀가 필요하면 먼저 새 사용자 변경과 충돌 여부를 확인하고, 이번 증분 패치만 별도 검토해 역적용하는 방법을 사용한다. 기존 P2-02/P2-01을 제거하거나 reset/clean/stash하지 않는다. 이 작업은 재검수 인계에서 종료하며 F02 또는 P2-03 등의 후속 작업을 자동 구현하지 않는다.
