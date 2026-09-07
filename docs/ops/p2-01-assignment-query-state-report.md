# P2-01 DB 배정 조회 상태 개선 · 검수 지적 수정본

2026-09-07, Asia/Seoul. 실제 제품 범위는 P2-01 하나다. 추가 검수 대응은 날짜 의존 단위 테스트 1곳과 원본 요구사항 증거 보완이다.

## A. 판정

**PASS — P2-01 로컬 합성 mock 검증 및 지적된 날짜 테스트 수정 범위.** A01–A10 E2E 63/63, 전체 단위 테스트 1115/1115, check/build가 통과했다. 운영 적용·실제 저장 성공·Production safe 판정은 아니다.

이전 HOLD 사유는 두 가지였다. 고정 배정일과 실제 실행일이 어긋나던 기존 단위 테스트를 수정했고, 독립 검수에서 확보하지 못했던 감사 원본과 승인 요구사항 원문을 제공했다. 이번 결과는 새 변경본의 로컬 검증이며 이전 독립 검수 PASS를 새 변경본 전체에 재사용한 것이 아니다.

## B. 기준과 변경본 식별

- 원본 저장소: `C:/work/boa-main`, `origin=https://github.com/raonisi/boa.git`, `main`, 시작·종료 working tree clean.
- 기준 HEAD: `0d87e5cd81278dcf3f15cce7a3d6aace0fd6e6af`. 감사 HEAD와 동일하다. 감사 당시 운영 표시 배포 ID `5da4cac`의 현재 유효성은 확인하지 않았다.
- 작업 공간: `C:/work/boa-p2-01`, 브랜치 `codex/p2-01-assignment-query-state`. 커밋하지 않은 로컬 변경이다.
- 새 제품 3개 + 테스트 4개의 내용 식별값: `ddff112f64c544f2df6e2fc4dda2a31d0b63f1bfa641f2f74b56fcfc474e2569`.
- [새 검수 manifest](/C:/work/boa-p2-01-review-fix-evidence/review-manifest.json): 문서까지 8개 파일의 SHA-256, 추적/비추적 구분, 전체 패치 SHA-256, 검증 증거 해시.
- [새 전체 패치](/C:/work/boa-p2-01-review-fix-evidence/p2-01-review.patch): 추적 수정 5개와 신규 비추적 3개를 포함한다. 역방향 `git apply --check --reverse`로 현재 변경본과 일치를 검사한다.
- 이전 내용 식별값 `3bcbfbda401f9b0ee796a3b5e01f7b6820ec5b924b57b012f8a1932694df7e76`, 이전 패치 SHA-256 `960753089a922987bb37320c175c9f824857f2e526fe65de22c23071f7bad933`의 증거는 기존 폴더에 보존했다. 수정 시작 시 이전 7개 해시를 모두 대조했다. 제품 3개와 P2-01 테스트 3개는 현재도 바이트 단위로 동일하다.
- 이후 파일 내용이나 커밋·배포본이 달라지면 새 식별값과 증거를 생성해야 한다. 기존 PASS를 다른 변경본에 재사용하지 않는다.

## C. 원인·원문 대조·검수 지적 해결

최초 작업은 단일 에이전트의 좁은 UI hotfix였다. 루트 `AGENTS.md`, `boa-crm-full-build` 스킬, `docs/ops` workflow/RBAC safety/checklist/evidence QA/E2E/UI UX/review/report 정책을 읽었다. 적용 경로에 별도 `AGENTS.md`는 없다. 구조 탐색 후 실제 파일을 읽었으며 감사 파일·줄번호는 탐색 단서로만 사용했다.

감사 HEAD와 현재 기준 코드 사이 P2-01 관련 차이는 없었다. 화면이 조회 결과를 `data ?? []`로 대체하고 `length ?? 0`으로 집계하여 목록에 로딩·실패 정보가 전달되지 않았다. 수정 전 요청 실패 화면에도 정상 0건과 빈 상태가 남고 재시도는 없었다.

현재 구현은 최초 실패·로딩·실제 0건·필터 0건을 구분한다. 갱신 실패 시 이전 고객 행/집계를 숨기고 ‘최신 상태 확인 실패’, ‘마지막 조회 자료’, ‘확인 불가’를 안내한다. 재조회 진행·일시 정지·실패에는 배정/배분 및 열린 확인창의 확정을 차단한다. 재시도는 검색·필터·조회 입력을 유지하고 새 성공 목록에서 사라진 선택을 정리한다. 배정 화면의 고객/사용자 조회 키에 계정·역할·계정 상태·팀·상위 조직·세션 무효화 시점을 포함하고 범위 변경 시 화면 상태를 초기화한다. 기존 tRPC 키 접두부와 서버 입력, 전역 인증 오류 구독, invalidation을 유지한다.

추가 검수 대응은 제품 수정 없이 진행했다. `server/crm.test.ts`의 합성 고객 배정일은 2026-05-13인데 `customerContactReasons`는 `new Date()`로 실행일을 읽는다. 2026-09-07에는 실제 90일이 지났으므로 ‘새 배정 고객’이라는 테스트 전제가 깨졌다. 수정 전 같은 실패를 다시 재현했다. 해당 테스트에서 Date만 고정하고 finally로 복원했으며, 배정 당일·89일째의 기존 미포함 assertion과 90일째 포함을 경고/연락 사유 양쪽에서 검사한다. 90일 정책·API·DB mock은 그대로다.

원본 증거를 별도로 제공한다.

- [감사 원본 P2-01](/C:/Users/이도현/.codex/visualizations/2026/09/07/01a07a0c-e5aa-7621-abc8-009b63364a13/boa-audit/BOA-UI-UX-Audit.md:22): SHA-256 `4295718c7f760f96270e8d31c1af93b80786c98102bf2d05abaf631a7cc37dd4`.
- [최초 승인 요청 전체 원문](/C:/work/boa-p2-01-review-fix-evidence/approved-request-original.md): 작업 기록의 userMessage에서 그대로 회수했다. SHA-256 `e4f03c8aa2e36f1edd07e95a4badf1df7d61b9409cb05608f8469de902db81b1`.
- [출처·메시지 ID·해시](/C:/work/boa-p2-01-review-fix-evidence/source-provenance.json), [12개 기대 동작·검수 지적 대조표](/C:/work/boa-p2-01-review-fix-evidence/requirements-map.md).
- 감사 문서의 P2-01~03 후속 구현 초안은 배경이다. 승인된 제품 범위는 P2-01뿐이며, 이번 테스트 보정은 사용자의 ‘검수 결과다 오류해결’ 요청에 따른다.

## D. 변경 파일

| 구분 | 파일 | 이유 |
|---|---|---|
| 제품·추적 수정 | `client/src/pages/CustomerAssign.tsx` | 조회 상태 연결, 배정/배분·확인창·실행 함수 가드, 범위 전환 초기화와 성공 재조회 선택 정리 |
| 제품·추적 수정 | `client/src/components/customers/CustomerAssignCustomerList.tsx` | 공통 상태 컴포넌트 재사용, 실패 집계·안내·재시도, 필터 0건 구분 |
| 제품·신규 비추적 | `client/src/lib/customerAssignQueries.ts` | 기존 API를 호출하는 화면 전용 조회, 범위별 캐시 키와 인증/권한 오류 처리 |
| 테스트·추적 수정 | `client/src/components/customers/CustomerAssignCustomerList.test.tsx` | 목록 상태 렌더링 회귀 12개 추가 |
| 테스트·추적 수정 | `e2e/fixtures/mock-trpc.ts` | 합성 응답 교체/지연 훅. 기존 기본 응답·assertion 유지 |
| 테스트·신규 비추적 | `e2e/customer-assign-query-state.spec.ts` | A01–A10 및 실제 브라우저 요청 abort, mutation 요청 0건 확인 |
| 테스트·추적 수정·이번 추가 | `server/crm.test.ts` | 날짜 의존 실패 보정, 89/90일 경계 확인, Date 복원 |
| 문서·신규 비추적·이번 갱신 | `docs/ops/p2-01-assignment-query-state-report.md` | 새 결과·원문 출처·변경본 식별과 한계 기록 |

최초 제품 영향 범위 3개를 유지했다. 추적 파일 diff는 5개 +232/-43이며 신규 3개는 전체 패치/manifest에 별도 포함한다. 이번 추가 변경은 테스트 1곳과 이 보고서뿐이다. 임시 스크립트·원문 증거·로그·화면·패치는 저장소 밖 증거 폴더에 분리했다. `node_modules` junction으로 기존 의존성을 사용하며 package.json/lockfile/scripts를 바꾸지 않았다. `dist`/캐시/E2E 실행 생성물은 검수 코드가 아니다.

## E. A01–A10 실행 결과

아래는 이번 수정본에서 다시 실행한 합성 mock 기반 클라이언트 검증이다. 실제 배정 저장이나 운영 서버 권한 검증의 증거가 아니다.

| ID | 검증 | 결과 |
|---|---|---|
| A01 | 최초 응답 지연, 로딩 표시·정상 0건 없음 | PASS |
| A02 | 합성 tRPC 오류 및 실제 브라우저 인터넷 연결 실패 abort, 안내·재시도·확인 불가 | PASS |
| A03 | 성공 []에만 정상 빈 상태와 0건 | PASS |
| A04 | 지점장/부지점장/팀장 합성 목록·선택·확인창 유지, 저장 없음 | PASS |
| A05 | 필터 결과 0건 안내·초기화, 원래 전체 건수 유지 | PASS |
| A06 | 검색·상담상태·유입경로·API 입력 유지한 재시도와 오류 해제 | PASS |
| A07 | 갱신 실패·오프라인 paused 상태, 열린 배정/배분 확정 차단, 이전 행·집계 숨김 | PASS |
| A08 | 계정/조직/역할 전환 후 새 응답 지연 동안 이전 행·집계·선택 비노출 | PASS |
| A09 | FORBIDDEN 캐시 숨김, UNAUTHORIZED 기존 로그인 이동 유지. OAuth 합성 응답으로 외부 요청 차단 | PASS |
| A10 | 1440×900/390×844/320×844, 문구·버튼·가로 넘침·클릭 도달·Tab/Enter, 화면 재확인 | PASS |

추가로 users 조회만 실패하면 성공 고객 목록을 유지하고 배정만 막는 케이스가 포함된다. 총 63/63 통과, 세 프로젝트, skip 없음. 독립 검수자의 추가 8개 외부 하네스(320×740/CSS zoom 포함)는 그 검수자의 과거 기록이며 이번 실행 수에 합산하지 않았다.

## F. 실제 명령·결과

Windows CMD, Node v24.15.0, pnpm 10.4.1. PowerShell CET 실행 오류 때문에 CMD를 사용했다. 새 증거 루트는 `C:/work/boa-p2-01-review-fix-evidence`이며 아래 로그명은 이 폴더 기준이다.

[run-safe.cjs](/C:/work/boa-p2-01-review-fix-evidence/run-safe.cjs)가 OS 기본 환경 변수만 넘긴다. .env 없는 분리 worktree, 빈 DATABASE_URL, dotenv 파일 로딩 제외, 자동 푸시 비활성화, 127.0.0.1:3197, 합성 Google client ID로 실행했다. 실제 호출 형식은 `node C:\work\boa-p2-01-review-fix-evidence\run-safe.cjs <로그명> <script> <인자>`이며 실제 pnpm 자식 명령은 아래와 같다.

| 실제 자식 명령 | 결과 | 로그 |
|---|---|---|
| `pnpm.cmd test server/crm.test.ts --testNamePattern=newly.assigned.old.customer` | 수정 전 재현 FAIL: 같은 1건, 필터 제외 312 | before-date-fix.log |
| `pnpm.cmd test server/crm.test.ts --testNamePattern=assignment.date.for.the.long.unmanaged.grace.period` | 수정 후 PASS: 1건, 필터 제외 312 | after-date-fix.log |
| `pnpm.cmd check` | PASS | check.log |
| `pnpm.cmd test` | PASS: 110 파일, 1115/1115, skip 없음 | test.log |
| `pnpm.cmd build` | PASS, 기존 대형 chunk 경고 | build.log |
| `pnpm.cmd test:e2e e2e/customer-assign-query-state.spec.ts --workers=2 --output=C:/work/boa-p2-01-review-fix-evidence/p2-01-e2e` | PASS: 63/63 | p2-01-e2e.log |
| `pnpm.cmd test:e2e e2e/core-smoke.spec.ts e2e/role-responsive-smoke.spec.ts --grep=assign --workers=2 --output=C:/work/boa-p2-01-review-fix-evidence/related-e2e` | PASS: 16 통과, 기존 모바일 전용 조건의 데스크톱 8 skip | related-e2e.log |
| `pnpm.cmd test:e2e e2e/role-responsive-smoke.spec.ts --grep=account --project=mobile-chromium --workers=1 --output=C:/work/boa-p2-01-review-fix-evidence/account-e2e` | PASS: 6/6, inactive/resigned 접근 차단 | account-e2e.log |

최초 P2-01 수정 전 전체 test는 1102 통과/1 실패, 첫 검수본은 1114 통과/동일 1 실패였다. [기존 증거](/C:/work/boa-p2-01-evidence/verified-test.log)와 [수정 전 P2-01 재현](/C:/work/boa-p2-01-evidence/baseline-p2-01.log)은 그대로 보존했다. 이번 날짜 보정 후 전체 test에서 해당 실패가 해소됐다. assertion·데이터 격리·접근성 baseline·보안 검사를 삭제하거나 약화하지 않았다. 전체 E2E/visual baseline/critical 저장 suite/실DB 접근성 suite는 실행하지 않았다.

## G. 화면·로그 증거와 개인정보

새 증거는 `C:/work/boa-p2-01-review-fix-evidence`에 있다. [1440px](/C:/work/boa-p2-01-review-fix-evidence/screenshots/error-1440.png), [390px](/C:/work/boa-p2-01-review-fix-evidence/screenshots/error-390.png), [320px](/C:/work/boa-p2-01-review-fix-evidence/screenshots/error-320.png)는 이번 A10 캡처의 동일 바이트 사본이며 다시 열어 확인했다. 출처/해시는 [screenshots.json](/C:/work/boa-p2-01-review-fix-evidence/screenshots.json)에 기록했다. 모바일 전체 페이지 캡처에는 스크롤 중 고정 헤더 위치도 포함되며 검수 대상은 오류 안내/재시도 영역이다.

새 실행 화면·로그에는 합성 고객/계정만 사용했다. 실고객정보·실제 토큰·.env 내용·운영 비밀값을 포함하지 않는다. 최초 감사 원본은 경로/해시로 참조하며 P2-01 텍스트 발췌만 복사했다. 운영 스크린샷은 복사하거나 업로드하지 않았다. 기존 [수정 전 합성 화면](/C:/work/boa-p2-01-evidence/screenshots/before-error.png)은 이전 재현 증거로 구분한다.

## H. RBAC/API/DB/런타임/배포 영향

- P2-01 UI 조회 상태·재시도·배정 가드·화면 캐시 키/수명만 바뀐다. 이번 추가 수정에는 제품 동작 변경이 없다.
- API 경로·입력·응답, 서버 RBAC·고객 범위·배정 정책·감사 이력은 변경 없음. 실제 코드의 teamLeaderOrAboveProcedure 허용 범위를 유지했다.
- DB/스키마/마이그레이션/운영 데이터 변경 없음. 데이터 준비·실제 배정 저장·업로드·내보내기·전화·메시지·푸시 실행 없음.
- 서버 제품 코드·런타임 버전/설정·인프라·의존성·Firebase·Railway 변경 없음. 커밋·푸시·머지·배포하지 않았다. 최신 운영 상태는 검증하지 않았다.

## I. 남은 불확실성·복귀

지적된 날짜 테스트 실패와 원문 증거 누락은 해소했다. 새 변경본의 독립 재검수는 아직 실행되지 않았다. 실제 저장 성공, 운영 서버 RBAC 전 범위, 실기기 Android/iOS, TalkBack/VoiceOver, 소프트 키보드, 실제 저속망은 미검증이다. 화면의 캐시를 보관하지 않으므로 재진입 시 재조회가 발생할 수 있다.

원본 boa-main/main은 그대로 사용할 수 있다. 미채택 시 분리 worktree/패치를 반영하지 않으면 된다. 전체 변경을 되돌릴 경우 현재 해시 확인 후 새 전체 패치만 역적용한다. 이번 날짜 테스트 변경만 되돌리려면 다른 수정이 없음을 확인한 뒤 패치의 server/crm.test.ts 부분만 역적용하되 기존 날짜 실패가 돌아온다. reset/clean/stash나 다른 사용자 변경 덮어쓰기는 사용하지 않는다. DB 복구는 필요 없다.

## J. 다음 작업 후보

P2-02. 이번에는 구현하지 않았다. 자동으로 다음 이슈를 시작하거나 배포하지 않는다.
