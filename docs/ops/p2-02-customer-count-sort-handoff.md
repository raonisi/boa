# P2-02 고객 수·빠른 필터·정렬 검수 인계

- 작업: IMPLEMENT-P2-02-CUSTOMER-COUNT-SORT-01, 2026-09-08 Asia/Seoul.
- 구현 상태: 부분 완료. 숫자·필터·정렬 연결은 구현했으나 B10의 기존 추천 조회량 문제를 남겼다.
- 자체 검증: 로컬 구현 검증 PASS / B10 기존 경로 FAIL / 실제 MySQL 검증 HOLD.
- 독립 검수: 미실시. 이 문서는 구현자의 자체 검증 기록이다.
- 커밋·푸시·PR 생성·병합·배포·운영 설정 변경은 실행하지 않았다.

## 기준과 작업 공간

| 항목 | 확인값 |
| --- | --- |
| 저장소 | https://github.com/raonisi/boa |
| 작업 공간 | `C:/work/boa-p2-02` |
| 브랜치 | `fix/p2-02-customer-count-sort` |
| BASE_SHA / HEAD | `60ea31217c8901b8f5fcb9aacee3a5fb9fbe8f83` |
| 시작 상태 | 전용 worktree 생성 직후 clean |
| 원본 | `C:/work/boa-main`, main, `0d87e5cd81278dcf3f15cce7a3d6aace0fd6e6af`, 기존 clean 상태 보존 |
| P2-01 근거 | BASE는 PR #166의 squash merge이며 CustomerAssign 조회 상태 개선과 Calendar 대비 수정이 포함됨 |

P2-01의 기존 CI 기록은 재사용했다. 후보 `6471bf794c4808a30f687f8520c475e04486281e`의 Quality Gate 실행 `34208848769`, 병합 main BASE의 실행 `34209229828`은 필수 7개 성공 기록이다. 이 기록을 P2-02 CI PASS로 재사용하지 않는다. 이전 증거 `C:/work/boa-calendar-a11y-20260907-evidence`는 덮어쓰지 않았다.

루트 AGENTS, boa-crm-full-build 스킬, docs/ops의 workflow·RBAC safety·evidence-based QA·E2E·UI 체크리스트를 읽었다. CodeGraph의 구조 인덱스로 고객 라우터 심볼을 찾고 현재 원문으로 확인했다. 추천·인증 의존 경로 확인을 위해 안내한 탐색 확장을 한 번 사용했다. 전체 저장소 감사로 확장하지 않았다.

## 재현된 원인

1. 빠른 필터 배지는 `filtered` 배열, 즉 기본 화면에서는 현재 페이지 고객으로 계산됐다. 합성 데이터 총량 123명/페이지 20명에서 수정 전 실제 화면은 분류 탭 전체 123, 빠른 필터 전체 20을 표시했다. B01이 수정 전 실패하고 수정 후 통과했다.
2. 업무 필터에서는 목록의 page/pageSize를 생략해 전체 고객을 읽은 뒤 브라우저 필터와 실행 점수 재정렬을 적용했다. 서버 정렬 선택과 무관하게 점수순으로 바뀌었다.
3. `getCustomerSegmentCounts`도 전체 고객 및 분류 메타를 읽고 메모리에서 계산했다.
4. URL 초기 상태의 page/view까지 필터 비교 문자열에 들어가 첫 페이지로 돌아갔다. 비교 대상을 실제 서버 필터로 제한했다.
5. 별도 담당자와 내 담당을 함께 지정할 때의 기존 브라우저 AND 조건도 서버 목록/집계에 보존했다.
6. 오류/미도착 총량이 현재 배열 길이나 0으로 대체됐으며 설명은 고정된 실행 점수순이었다.

과거 감사의 106/70/20/18은 현재 값이나 테스트 정답으로 사용하지 않았다.

## 제품 변경 파일 (4개)

| 파일 | 이유 |
| --- | --- |
| `client/src/pages/CustomerList.tsx` | 페이지 집계 제거, 서버 필터/정렬 연결, 총량과 현재 페이지 구분, 오류·재시도·갱신 안내, 페이지 보정, 계정 범위 변경 시 선택 상태 초기화 |
| `client/src/lib/customerListQueries.ts` (신규) | 적용 검색 조건과 업무 필터를 같은 목록/집계 입력에 연결. P2-01 scope key·인증 오류 판별 재사용. 캐시 키와 취소 signal, 고객 변경 시 집계 무효화 연결 |
| `server/routers.ts` | 기존 activeUserProcedure 및 고객/후속 권한 helper 재사용, 선택적 조회 조건 추가, quickCounts 추가 |
| `server/db.ts` | 기존 권한·일반 필터 조건을 목록/집계에서 공통 사용. COUNT DISTINCT/EXISTS 집계, 업무 필터를 정렬·페이지 제한 전에 적용 |

테스트 파일: `server/customer-list-counts.test.ts`(신규 SQL 구성/실패/정렬 검증), `server/customers.scope-filter.test.ts`(기존 테스트 보존 및 집계 권한 추가), `e2e/customer-list-count-sort.spec.ts`(신규 B01~B07/B11 UI), `e2e/fixtures/customer-list-counts.ts`(신규 123명 합성 fixture), `e2e/fixtures/mock-trpc.ts`(기존 변환 callback에 요청 입력을 추가 전달; 기존 callback 호환).

문서 파일은 이 문서 한 개다. 저장소 밖 SQLite 보조 검사·실행 도우미·로그·스크린샷은 임시 검증 증거이며 제품/의존성 변경이 아니다.

## 집계 정의

공통 범위 C는 **현재 로그인 사용자의 기존 서버 권한 범위 + 현재 고객 분류**이다. 전체 결과는 C에 현재 적용 검색·일반 필터·업무 조건을 모두 적용한 고유 고객 수다. 현재 페이지는 이 결과에서 실제 조회한 행 수다. 검색 입력은 기존대로 제출했을 때 적용되며 입력 중인 글자를 집계 조건으로 사용하지 않는다.

아래 모든 빠른 필터 클릭은 검색, 상태, 지역, 유입, 우선순위, 태그, 다음 액션, 담당자, scope, 추천/업무 필터, 배정 기간을 초기화한 뒤 해당 조건을 설정한다. 고객 분류·기존 권한·선택 정렬·페이지 크기는 보존하고 페이지는 보정한다. 재클릭은 해제가 아닌 같은 필터 재적용이다.

| 필터 | 초기화 후 설정 | 서버 조회 조건 | 비활성 배지 대상 | 선택 후 전체 결과 |
| --- | --- | --- | --- | --- |
| 전체 | 추가 없음 | C | C 전체 | C 전체 |
| 오늘 연락 | priority-contact | C ∩ 기존 추천 최대 50개 ID | 동일 | 동일 |
| 긴급 | priority-urgent / high | C ∩ 위 추천 중 high ID | 동일 | 동일 |
| 미상담 | uncontacted | C ∩ consultStatus=미상담 | 동일 | 동일 |
| 지연 | sla-overdue | C ∩ 미상담 ∩ 담당자 있음 ∩ 배정 후 24시간 초과 | 동일 | 동일 |
| 다음 액션 없음 | no-next-action | C ∩ nextAction NULL 또는 빈 문자열 | 동일 | 동일 |
| 내 담당 (지점장) | scope=mine | C ∩ 서버 로그인 사용자 ID의 담당 고객 | 동일 | 동일 |
| 신규 DB | 기존 newDbDateRange | C ∩ assignedAt이 기존 UTC 날짜 시작~끝 사이(양 끝 포함) | 동일 | 동일 |

활성 배지는 현재 적용 결과 총량을 표시한다. 일반 필터가 있을 때 기존 활성 판정이 `all`을 반환하는 동작도 보존하여, 이 경우 활성 전체 배지는 현재 결과 총량이다. 비활성 필터의 숫자는 클릭 후 초기화될 조건을 반영한다. 겹치는 필터의 배지를 더해 전체를 맞추지 않는다.

‘오늘 연락’은 새로 정의한 당일 후속 대상이 아니다. 현행 추천 점수 양수/상위 최대 50개 정책을 보존했다. 후보 ID는 서버 권한·분류 조건과 AND로 결합하는 축소 조건이며 권한을 부여하지 않는다. 비로그인·비활성/퇴사 계정 및 담당자 범위 거부는 기존 procedure/helper를 통과해야 한다.

기존 오늘/기한 경과 후속 URL 프리셋도 페이지 제한 전에 EXISTS로 좁힌다. 기존 getFollowUpScope와 scheduled/postponed, deletedAt 없음, 기존 KST 마감 시각을 재사용했다. 후속·일정 동기화나 날짜 정책을 바꾸지 않았다.

## 정렬 대응

| 선택/요청 | 실제 서버 순서 | 안내 |
| --- | --- | --- |
| recent | createdAt 내림차순 | 최근 등록순 |
| name | 이름 오름차순, createdAt 내림차순 | 고객명순 |
| next_contact | 삭제되지 않은 후속의 최소 다음 연락일, NULL 뒤, createdAt 내림차순 | 다음 연락순 |
| contract_value | 기존 유효 계약 월납보험료 합계 내림차순, createdAt 내림차순 | 월납보험료순 |

페이지 내 실행 점수 재정렬을 제거했다. 실행 점수 산식·추천 점수·우선순위 정책은 변경하지 않았다. 집계 키/SQL에는 페이지·크기·정렬을 포함하지 않는다. 분류 탭 집계는 기존 `{all,database,contracted}` 의미를 유지한다.

별도 quickCounts를 선택한 이유: `customers.list` 배열 응답을 유지하고 페이지/정렬 변경 시 배지 집계를 다시 요청하지 않기 위해서다. 현재 조건의 분류 집계는 기존 segmentCounts를 재사용한다. 새 hook의 집계 키는 기존 list 무효화 prefix를 유지하므로 화면/상세의 기존 list invalidate가 숫자도 갱신한다.

## 검증과 한계

모든 실행은 별도 worktree에서 OS 필수 변수만 허용한 `run-safe.cjs`를 통해 수행했다. DB URL은 비우고 dotenv 파일이 없는지 확인했으며 scheduler를 끄고 E2E를 127.0.0.1:3587에 한정했다. 브라우저는 외부 요청을 차단하고 tRPC 응답과 변경 요청을 mock으로 처리한다. 테스트 계정·고객·계약은 합성 데이터다. 비밀값을 출력하거나 운영 DB를 조회/변경하지 않았다.

| ID | 판정/방법 | 근거·한계 |
| --- | --- | --- |
| B01 | PASS, 수정 전/후 mock E2E | 수정 전 전체 123/배지 20 재현, 수정 후 배지 123 |
| B02 | PASS, mock E2E + SQL 구성/SQLite | 20/50 크기, 50명씩 3페이지, 전체 123 유지. 페이지 3 보존 및 범위 보정 |
| B03 | PASS, mock E2E + SQLite | 8개 필터의 독립 기대값, 선택 전후와 재클릭 확인 |
| B04 | PASS, mock E2E + SQLite | 제출 검색·우선순위·분류·초기화와 페이지 보정, 권한 밖 검색 제외 |
| B05 | PASS, mock E2E + SQL 구성/SQLite | 4개 정렬 요청·실제 첫 고객 ID·문구, 총량 불변. 점수 산식 불변 |
| B06 | PASS, mock E2E + SQL 실패 단위 | pending/정상 0/실패/재시도/성공 후 갱신 실패. 실패 집계는 확인 불가 |
| B07 | PASS, mock E2E | 응답 역전, 계정·역할·조직 변경, 분류 변경, 선택 초기화, mock 등록 후 목록/두 집계 갱신. 실제 저장 검증 아님 |
| B08 | HOLD (단위/SQLite PASS) | 네 활성 역할의 실제 라우터 scope와 SQL 조건 확인. 실제 MySQL의 역할별 목록/집계 통합 실행 미실시 |
| B09 | PASS, 서버 createCaller 단위 | 비로그인/inactive/resigned 거부, member scope 조작·권한 밖 담당자 거부, ID 입력 한도. 실제 HTTP 세션 통합 검증 아님 |
| B10 | FAIL 기존 추천 경로 / HOLD MySQL | 새 집계는 DISTINCT/EXISTS·단일 집계, 중복 계약/후속 고유 수 검증. 보존한 추천 API는 전체 자료/N+1 조회. 실제 MySQL 성능·실행 계획 미확인 |
| B11 | PASS, Chromium mock 화면 | 1440×900, 390×844, 320×740 총량/정렬·키보드·가로 넘침. 실기기 미검증 |
| B12 | PASS, mock E2E + 공유 조건 단위 | 63/63 PASS 후 마지막 서버 AND 조건 보완. 최종 코드에서 A01~A10을 포함한 desktop 21/21 및 B11 3/3 추가 PASS. 기존 병합/CI 기록과 구분 |

실제 MySQL/MariaDB/Docker 실행 파일을 찾지 못했다. 운영 자격 증명이나 외부 DB로 대체하지 않았다. 별도 메모리 SQLite에서 Drizzle이 생성한 SQL을 합성 fixture로 실행한 보조 검사(5개)는 조건·중복·순서 검증이며 MySQL 방언/드라이버·성능 검증을 대체하지 않는다. 이 보조 검사는 저장소 런타임/의존성을 변경하지 않는 외부 증거다.

| 실제 명령 | 결과/로그 (아래 증거 루트 기준) |
| --- | --- |
| `pnpm.cmd check` | PASS, `check-handoff.log` |
| `pnpm.cmd test` | 1137/1137 PASS, `unit-candidate.log` |
| `pnpm.cmd build` | PASS, `build-candidate.log` |
| `pnpm.cmd test:e2e customer-list-count-sort.spec.ts --project=desktop-chromium --workers=1 --output=C:/work/boa-p2-02-evidence-20260908/p202-results` | 11/11 PASS, `p202-e2e-verified.log` |
| `pnpm.cmd test:e2e customer-assign-query-state.spec.ts --workers=1 --output=C:/work/boa-p2-02-evidence-20260908/p201-results` | 63/63 PASS, `p201-regression.log` (마지막 서버 AND 조건 보완 전). 최종 코드의 추가 회귀는 아래 명령 참조 |
| `pnpm.cmd test:e2e role-responsive-smoke.spec.ts --grep=customer.list --project=desktop-chromium --workers=1 --output=C:/work/boa-p2-02-evidence-20260908/related-results` | 5 PASS / 기존 모바일 조건 1 skip, `related-presets.log` |
| `pnpm.cmd test:e2e --config=C:/work/boa-p2-02-evidence-20260908/final-responsive.config.ts --workers=1` | 최종 코드 24/24 PASS (P2-01 21 + B11 3), `final-responsive-verified.log` |
| `pnpm.cmd test:e2e customer-list-count-sort.spec.ts --grep=B11 --project=desktop-chromium --workers=1 --output=C:/work/boa-p2-02-evidence-20260908/viewport-results` | 3/3 PASS, 스크롤 후 정렬 컨트롤의 클릭 중심 가림 검사 및 화면 저장, `viewport-verified.log` |
| `pnpm.cmd test --config=C:/work/boa-p2-02-evidence-20260908/sqlite.config.ts` | 5/5 PASS, `sqlite-candidate.log` |

중간 실패는 삭제하지 않았다: `before-b01.log`는 원 결함 재현, `after-b01.log`는 새 표시 helper의 인자 오류(수정됨), `server-focused.log`는 테스트의 DB 오류 래핑 기대 오류(원인 cause 검증으로 수정), `p202-e2e-first.log`는 페이지 초기화 결함과 행 선택자/기존 member 기본 분류의 테스트 기대 오류, `p202-e2e-final.log`는 신규 등록 버튼 이름 선택 오류다. 외부 최종 반응형 설정의 첫 실행은 webServer 작업 디렉터리 지정 누락으로 시작하지 못했고, 검증 설정에 cwd를 명시했다. 기존 assertion 삭제·skip 추가·baseline 완화는 하지 않았다.

## 증거와 검수본 고정

증거 루트: `C:/work/boa-p2-02-evidence-20260908`.

- `initial-state.json`: 시작 HEAD/브랜치/working tree와 환경 파일 이름.
- `before-b01-results/`: 수정 전 실패 화면·trace·context.
- `p202-results/`: 최종 화면/테스트 증거. `counts-1440.png`, `counts-390.png`, `counts-320.png`를 각 테스트 하위 경로에서 확인.
- `p201-results/`: P2-01 63개 회귀 결과. `final-responsive-results/`: 최종 코드 추가 회귀/화면.
- `viewport-results/`: 최종 CSS viewport 원본과 `count-sort-controls-1440/390/320.png`. 직접 화면을 읽어 총량/정렬 문구와 컨트롤 가림 여부를 확인했다. 모바일은 기존 긴 상단 영역 때문에 세로 스크롤이 필요하다.
- `candidate.patch`, `candidate-manifest.json`, `candidate-source/`: BASE 대비 추적/비추적 변경 전체, 파일별 SHA-256, 변경본 식별값. HEAD만으로 이 미커밋 변경을 식별할 수 없다.
- `run-safe.cjs`, `sqlite.config.ts`, `sqlite-counts.test.ts`, `final-responsive.config.ts`: 재현 도우미/보조 검증. Node 24.15.0, pnpm 10.4.1 사용.

staged 없음. 추적 수정 5개(`CustomerList.tsx`, `server/db.ts`, `server/routers.ts`, 기존 scope 테스트, mock-trpc), 비추적 의도 파일 5개(새 hook, 새 서버 테스트, 새 E2E, 새 합성 fixture, 이 문서)다. `node_modules` junction, dist, Vite/Playwright 캐시는 의도한 변경본이 아니다. 비밀 파일과 기존 사용자 파일은 패치/스냅샷에서 제외한다.

원격 main은 종료 전 재확인에서도 BASE와 동일했고 원본 working tree는 clean이었다.

증거에는 합성 데이터만 있으며 실제 고객 정보·토큰·비밀값을 포함하지 않는다. 검수본 생성 후 추가 제품 수정을 하지 않는다. 수정이 생기면 패치·해시·해당 테스트를 다시 생성해야 하며, 이후 다른 SHA의 병합/배포에 이 PASS를 자동 재사용하면 안 된다.

## 영향과 남은 검수 초점

- API: 기존 경로/응답 유지, 선택적 list 조건과 quickCounts 추가. shared list 소비자인 배정/파이프라인의 기본 조건과 분류 집계 소비자의 응답 형태를 보존했다.
- RBAC/고객 분류/감사 이력: 정책 변경 없음. 후보 ID는 기존 권한 범위를 좁히기만 한다. 분류는 기존 활성 계약 조건을 사용하며 상담 상태로 재정의하지 않았다.
- DB 스키마/DDL/마이그레이션/인덱스/데이터 보정, 실적 산식, 런타임/의존성, 운영/배포: 변경 없음.
- 복귀: 원본 main은 보존되어 있다. 독립 검수는 이 전용 worktree에서 수행한다. 필요 시 새 clean worktree를 BASE에서 만들어 비교한다. 사용자 변경에 reset/clean/stash를 적용하지 않는다.

다음 검수자가 집중할 항목은 최대 5개다.

1. 격리 MySQL에서 동일 fixture의 네 역할·중복 계약·정렬/페이지·SQL 드라이버 결과 및 실행 계획 검증.
2. 기존 추천 엔진의 전체 조회/N+1 제거는 점수/범위를 보존하는 별도 작은 작업으로 분리. 이번에 새 점수나 랭킹을 만들지 않음.
3. 신규 후보 ID 축소 조건, 기존 고객/후속 권한 helper의 일치 및 API 호환성 검수.
4. 실제 세션 갱신·계정/조직 변경과 고객 변경 후 캐시 무효화에 대한 통합 검수.
5. 실제 모바일 기기/브라우저 확인. 현재 증거는 Chromium CSS viewport이다.

P2-03에 착수하지 않으며 이 변경은 독립 읽기 전용 검수 인계에서 종료한다.
