# P2-05 상담·계약 폼 접근성 이름 연결 — 구현자 검수 인계

작업: `IMPLEMENT-P2-05-CONSULT-CONTRACT-A11Y-LABELS-01` · 2026-09-20 Asia/Seoul.
독립 검수: **미실시**. 이 문서는 구현자 자체 검증이며 독립 검수 PASS가 아니다.
**P2-05 IMPLEMENTATION CANDIDATE: FAIL — 표적 구현·검사는 완료했으나 A18 전체 E2E에 기존 실패 3건이 남아 있다.**
확정 실패를 HOLD/PASS로 바꾸지 않는다. 독립 검수는 미실시다.

## 기준과 작업 경계

- 저장소: `https://github.com/raonisi/boa.git`.
- BASE_SHA / HEAD: `32c5fa150678f411202d3d9f50fa64a96b089084` (P2-04 PR #170 포함).
- 시작 및 구현 후 `git ls-remote origin refs/heads/main`에서 동일 SHA 확인.
- 전용 작업 트리: `C:/work/boa-p2-05`; 브랜치: `codex/p2-05-consult-contract-a11y-labels`.
- 원본 `C:/work/boa-main`의 main은 `0d87e5c…`, clean이었다. 원본 checkout을 이동하지 않고 최신 원격 main에서 작업 트리를 분리했다.
- `AGENTS.md`, `boa-crm-full-build`, workflow/QA/E2E/UI/RBAC 정책을 읽었다. 제품 영향은 CustomerDetail 한 파일이다.
- 증거 루트: `C:/work/boa-p205-20260920-puzGDV` (이하 **E**). 실행 도우미: `C:/work/boa-p205-tools`.
- Windows 기본 PowerShell 실행 오류로 `cmd.exe / pnpm.cmd`를 사용했다. Node v24.15.0, 프로젝트 `.node-version`=24.
- package/lock이 동일한 기존 설치의 node_modules를 junction으로 사용했다. 원본 환경 파일·인증값은 복사하지 않았다.
- 모든 명령의 cwd/executable/argv/선별 환경/시작·종료 시각/exit/log는 `E/*.command.json`에 있다.

## 원인과 최소 변경

기준 코드의 ConsultModal, EditConsultModal, ContractModal은 보이는 Label에 htmlFor/id가 없고 SelectTrigger에는 aria-labelledby가 없었다. 값·placeholder가 있어도 필드 이름은 제공되지 않았다.

`useId()`를 모달 인스턴스별 prefix로 사용한다. native input/textarea는 Label htmlFor와 id, Select는 Label id와 trigger aria-labelledby로 연결했다. 정적인 계약 datalist ID도 같은 prefix로 분리하고 list 참조를 함께 연결했다.

재상담 예정일에는 기존 `createCalendarSchedule && !form.nextContactAt` 조건으로 aria-invalid/describedby, `createCalendarSchedule`로 aria-required를 연결한다. 계약 담당자는 기존 `requiresAgentSelection && form.agentId === "default"` 조건을 같은 방식으로 사용한다. 담당자를 선택하면 기존 오류 문구와 연결이 해제된다. 기존 save guard와 payload는 그대로다.

320px 계약 모달은 기준 커밋에서도 35px 가로 넘침이 있었다. 담당자 선택값이 좁은 2열을 넘치고 날짜가 잘렸다. 이번 responsive 수용 기준을 위해 **계약 모달 내부만** 모바일 1열 / sm 이상 2열로 만들고 SelectTrigger를 w-full/min-w-0로 제한했다. 공용 컴포넌트 변경은 없다.

Chromium 모바일 에뮬레이션의 320px 상담 추가/수정에서도 grid 자식의 intrinsic 최소 폭으로 13px 넘침이 발견됐다. `baseline-mobile`에서 기준 코드로 재현했고, 두 모달 내용 영역에만 `min-w-0`를 추가해 해소했다. 날짜 값/타입/동작은 변경하지 않았다.

## 변경 파일

| 구분 | 파일 | 이유 |
|---|---|---|
| 제품 | `client/src/pages/CustomerDetail.tsx` | 세 모달의 이름·오류·필수조건 연결, 고유 ID, 계약 모바일 폭 보완 |
| 테스트 | `client/src/pages/CustomerDetail.accessibility.test.tsx` | 실제 모달 선언을 SSR 렌더링해 35개 association/인스턴스 ID 검사 |
| 테스트 | `e2e/p2-05-consult-contract-a11y.spec.ts` | 실제 브라우저 이름, 네 모드/세 크기, 키보드, 오류, axe, mock payload, write 없는 smoke |
| 문서 | `docs/P2_05_CONSULT_CONTRACT_A11Y_HANDOFF.md` | 재현·검증·변경본 식별 인계 |

QuickConsultationModal, 공용 Select/Label, server/shared, schema/migration, package/lock, 테스트 설정·baseline, Release Identity, 배포 설정은 수정하지 않았다.

## 수정 전 증거

- `pre-fix-browser.log/.playwright.json`: PRE01 상담상태, PRE02 재상담 예정일, PRE03 상품명, PRE04 계약일의 동일 accessible-name assertion **4/4 실패**, 실제 이름 `""`. 제품 수정 전 수행.
- `pre-fix-component.log`: 이름 연결과 고유 ID assertion **35/35 실패**.
- `CustomerDetail.PRE_FIX.tsx`, `source-before.json`: 기준 소스와 전체 추적 파일의 수정 전 raw hash.
- `baseline-layout.log/.playwright.json`: 별도 detached BASE `C:/work/boa-p205-baseline`에서 계약 등록/수정 320px **2/2 실패**, 각각 overflow=35px. 제품 코드는 BASE와 동일하다.
- 수정 중 실수도 보존: `pre-fix.log`는 잘못된 script 호출, `check.log`는 새 테스트의 iterator 타입 오류, `browser-post.log`는 320px 기존 배치 실패, `targeted-v2.log`는 키보드 이동 완료 전 값을 읽던 테스트 동기화 실패다. 제품 결함 재현과 구분한다.
- `build.log`와 `bundle-check.log`는 실행 도우미의 NODE_ENV=test 빌드에 대한 결과다. 도우미를 고쳐 production build/bundle을 다시 측정했으며 예산·assertion은 변경하지 않았다.

## 필드 / 접근성 이름 행렬

SSR은 실제 private 모달의 AST 선언을 TypeScript로 컴파일해 기존 native/Select/Label 컴포넌트와 렌더링한다. dialog portal shell·조회 데이터만 합성 대체한다. SSR 속성 검사만으로 accessible name을 주장하지 않으며, 브라우저의 `toHaveAccessibleName` / `getByRole` / `getByLabel`을 함께 실행한다.

| ID | 모드 | 화면 라벨 / accessible name | 방식 |
|---|---|---|---|
| T01–T04 | 상담 추가 | 상담상태 / 상담유형 / 고객 니즈 / 다음 액션 | Select visible Label id → aria-labelledby |
| T05–T07 | 상담 추가 | 상담 요약 / 상세 메모 / 재상담 예정일 | htmlFor → native id |
| T08–T09 | 상담 추가, 일정 활성 | 일정 제목 / 알림 | native / Select |
| T10 | 상담 수정 | 위 4개 Select 동일 | aria-labelledby |
| T11 | 상담 수정 | 상담 요약 / 상세 메모 / 재상담 예정일 | htmlFor/id |
| T12–T16 | 계약 등록·수정 | 보험사 / 상품명 / 상품군 / 계약일 / 월보험료 (원) | htmlFor/id |
| T17–T19 | 계약 등록·수정 | 납입상태 / 계약상태 / 담당 설계사 | aria-labelledby |
| T20 | 계약 등록·수정 | 메모 | htmlFor/id |

선택값을 이름으로 사용하지 않는다. 동시 create/edit 인스턴스에서 고유 ID와 htmlFor/aria-labelledby/aria-describedby/list 참조를 검사한다. 브라우저 열린 화면에서도 중복 ID=0을 확인한다.

## 오류·키보드·반응형

| ID | 검사 |
|---|---|
| E01 | 일정 등록 false → 재상담 예정일 invalid/required false |
| E02 | 일정 등록 true + 빈 날짜 → required/invalid/describedby 및 기존 오류 문구, 저장 disabled |
| E03 | 날짜 입력 → invalid/describedby 해제, 저장 enabled |
| E04 | 담당 지정 필요 + default → required/invalid/describedby, 등록 클릭의 mutation 차단 |
| E05 | 담당 선택 → invalid/describedby 및 오류 문구 해제 |
| E06 | 두 오류의 기존 한국어 문구를 exact accessible description으로 확인 |

- 네 모드 × 1440×900 / 390×844 / 320×740에서 이름, 가로 넘침, label clipping, 날짜 입력, 스크롤, 마지막 필드·버튼 겹침, 취소, write=0을 검사한다.
- Tab/Shift+Tab 순서를 끝까지 검사한다. Chromium date 입력의 내부 segment Tab은 같은 control로 묶고 각 필드 누락 없이 순서를 비교한다.
- 초기 focus가 dialog 내부인지, 순환 중 이탈=0, positive tabindex=0, focus-visible/ring, Enter/Space·Home/ArrowDown/Enter·Escape를 검사한다. Select Escape 후 dialog 유지, 다시 Escape 후 dialog 닫힘을 확인한다.
- 날짜/담당 오류 상태도 세 크기에서 control/error 겹침과 가로 넘침을 별도 검사한다.
- 표적 axe: 열린 네 모달의 label/select-name/button-name/ARIA 유효성·연결·중복 ID·label-content-name-mismatch 12개 규칙. 기존 전체 페이지 contrast/viewport baseline을 대체하거나 확대하지 않는다.
- QuickConsultationModal의 `상담 메모 (선택)` / `다음 액션` 실제 이름 smoke를 통과했으며 제품 수정 0.
- QuickConsultationModal 진입 버튼은 기존 모바일 UI에서 숨겨진 데스크톱 전용 경로다. 이 최소 smoke는 1440×900을 명시하며 모바일 진입 기능을 새로 만들거나 숨겨진 버튼을 강제 클릭하지 않는다. 직접 수정 대상 네 모드는 모바일까지 모두 검사한다.
- 합성 PNG와 geometry/keyboard/axe JSON은 Playwright JSON의 attachment 및 `E/*-attachments/`에 있다. 실고객/토큰/비밀값 없음.

## 저장·보호 범위

`semantic-comparison.json`: 상담 추가 33, 상담 수정 22, 계약 29개 AST 표현식(상태 초기값·변경/저장 핸들러·값·disabled·기존 validation 조건) 동일. import useId를 제외한 대상 모달 앞 코드도 EOL 정규화 후 동일하다.

브라우저 mock mutation 4개는 고정 합성 기대 payload와 비교한다. 상담 create의 customerId / edit의 id, 계약 create의 agentIdOverride / edit의 newAgentId, 기존 enum·숫자 변환·날짜 문자열·메모가 유지된다. DB 저장 성공이나 서버 권한 통과의 증거로 표현하지 않는다. read-only smoke는 이 mutation 테스트와 분리하며 쓰기 요청 0을 assert한다.

## 실행 결과

실행 도우미는 OS/PATH 환경만 allowlist로 전달하며 DB URL은 빈 값, scheduler=false, localhost port3295(기준 비교3296)를 사용했다. 실제 서비스 자격증명/운영 .env를 전달하지 않는다. build만 NODE_ENV=production, 검사는 test, E2E dev server는 development다.

| 실제 pnpm.cmd 명령 | 결과 | 근거 |
|---|---|---|
| `test client/src/pages/CustomerDetail.accessibility.test.tsx` | 35 PASS | component-post.log |
| `check` | PASS | check-final-v2.log (최종 소스) |
| `test` | 115 files / 1239 tests PASS | unit-final-v2.log (최종 소스) |
| `build` (NODE_ENV=production) | PASS | build-final-v2.log (최종 소스) |
| `bundle:check` | 4 budgets PASS | bundle-final-v2.log; `bundle` script는 없음 |
| `test:e2e e2e/p2-05-consult-contract-a11y.spec.ts --project=desktop-chromium --workers=1 --reporter=list,json --output=…/targeted-v3-results` | 38 PASS | targeted-v3.log/.playwright.json (오류 배치 2개 추가 전) |
| `test:e2e --reporter=list,json --output=…/full-results` | 509 PASS / 102 기존 skip / 7 FAIL (중간 후보) | e2e-full.log/.playwright.json |

전체 E2E에는 core smoke, P2-01 query-state, P2-02 count-sort, P2-03 today-overdue, P2-04 target, 역할/모바일 회귀와 최종 P2-05가 포함된다. 파일별 pass/fail/skip 최종 수치는 결과 집계에 기록한다. 기존 viewport 게이팅 skip은 새 skip과 구분한다. 신규 skip/force click/timeout 확대/기존 assertion·baseline 변경은 없다.


최종 전체 E2E 결과 (`quality-summary.json`):

최종 명령: `pnpm.cmd test:e2e --workers=4 --reporter=list,json --output=C:/work/boa-p205-20260920-puzGDV/full-final-results`.
종료 코드 1. 513 PASS / 102 기존 skip / 3 FAIL / 0 flaky. 앞선 기본 workers=2 전체 실행의 발견 사항을 보완하고 최종 소스로 재실행했다. timeout/skip/assertion은 변경하지 않았다.

| spec | PASS | FAIL | 기존 skip |
|---|---:|---:|---:|
| core-smoke.spec.ts | 87 | 0 | 9 |
| customer-assign-query-state.spec.ts | 63 | 0 | 0 |
| customer-detail-mobile-actionbar.spec.ts | 30 | 0 | 0 |
| customer-list-count-sort.spec.ts | 33 | 0 | 0 |
| p2-03-today-overdue.spec.ts | 36 | 0 | 0 |
| p2-04-followup-target.spec.ts | 29 | 1 | 0 |
| p2-05-consult-contract-a11y.spec.ts | 120 | 0 | 0 |
| role-responsive-smoke.spec.ts | 90 | 0 | 39 |
| visual/core-screens.visual.spec.ts | 25 | 2 | 54 |

P205-01–10 / T01–20 / E01–06 PASS. 최종 P2-05는 40개 시나리오 × 세 프로젝트 = 120 PASS, 신규 skip 0. 세 CSS 크기는 각 프로젝트에서 명시한다. 별도 최종 모바일 표적 40/40도 통과했다 (`p205-mobile-final.log`).

기존 실패 분리 증거:

- P204-07 `/calendar` mobile: 해당 버튼 이름에서 대기 timeout. 기준 커밋 원본 spec의 `baseline-p204` 1 PASS / 1 FAIL로 재현. P2-04 수정 0.
- 고객 목록 mobile390 / mobile360 스냅샷: 기준 커밋에서도 각각 25,684 / 5,558 pixels 차이. `baseline-list-visual`의 390 첫 실행은 page.goto timeout이었고, `baseline-list-390`에서 실제 스냅샷 차이를 재현했다. 기준/최종 후보 actual PNG가 각각 byte-identical (`full-final-results-baseline-comparison.json`). baseline 업데이트 0.
- 중간 후보의 P2-05 실패 4건(상담 모바일 폭 3, 데스크톱 전용 퀵 상담 진입 1)은 최종 120개 검사에서 해소됐다. 이전 실패 로그도 보존한다.

격리 MySQL을 사용하는 별도 `test:e2e:accessibility`/critical suite는 이번 이름 연결의 mock 기반 표적 검사와 다르다. 준비된 DB 없이 실행하지 않으며 전체 axe/실DB/실기기/스크린리더 음성/운영 UI 검증 PASS로 확대 해석하지 않는다.

## 수용 기준 A01–A20

| ID | 최종 판정 근거 |
|---|---|
| A01 | PRE01–04 수정 전 실제 이름 빈 값 재현 |
| A02–A04 | 상담 추가 Select/날짜/기타 입력 실제 이름 |
| A05 | 상담 수정 전체 필드 |
| A06–A09 | 계약 두 모드 native/Select 이름 |
| A10 | SSR 동시 인스턴스 및 브라우저 duplicate id=0 |
| A11–A12 | 날짜/담당 오류와 required 연결·해제 |
| A13 | 기존 guard와 validation AST 동일, 오류 상태 실제 동작 |
| A14–A15 | 네 모드/세 크기 키보드 순서, trap, Select, Escape |
| A16 | 세 크기 배치/스크롤/날짜/오류 geometry 및 합성 화면 |
| A17 | 표적 axe 위반 0, 기존 baseline 변경 0 |
| A18 | **FAIL** — check/test/build/bundle PASS, 전체 E2E 기존 실패 3건 |
| A19 | 84 AST 표현식 동일 + 네 mock mutation payload 일치 |
| A20 | **PASS(변경 회귀 없음)** — 보호 파일 동일/관련 검사. 기존 실패는 A18 FAIL로 유지 |

A01–A17, A19, A20: PASS (로컬 검사 범위). A18: FAIL. 전체 수용 조건에 예외를 만들지 않았으므로 후보 종합 판정은 FAIL이다. `E/acceptance.json`에 개별 판정도 기록한다.

## 변경본 식별 및 독립 검수

최종 식별 자료는 `E/candidate-manifest.json`이다. BASE/HEAD/branch, staged/unstaged/untracked, 의도한 네 파일의 raw SHA-256 및 Git canonical blob, 전체 후보 ID, full/product/tests patch SHA-256을 포함한다. 문서 자체의 hash 순환을 피하기 위해 이 문서는 manifest 경로를 참조하고, manifest는 완성된 이 문서를 해시한다.

- `full.patch`: 추적 파일 diff와 새 테스트·문서 전체 내용 포함.
- `product.patch`: CustomerDetail만.
- `tests.patch`: 새 component/E2E 두 파일.
- source 보호 비교와 `git diff --check`, 원본/후보 작업 상태도 별도 증거로 보존한다.
- `node_modules` junction, dist/release stamp, quality-results, baseline 관찰용 worktree, 실행 도우미와 E는 임시 검증물이며 제품 diff에 포함하지 않는다.
- 검수자는 동일 BASE의 별도 작업 트리에 full.patch를 적용하고 manifest의 canonical blob/raw hash를 확인한다. EOL 변환이 있으면 canonical blob 일치와 raw 차이를 구분한다. 수정이 생기면 후보 ID·patch·검증 증거를 새로 생성한다.
- 복귀는 이 미커밋 후보를 채택하지 않는 방식이다. 원본/운영에는 적용된 변경이 없다. 다른 사람의 변경을 reset/clean/stash하지 않는다.

남은 범위: 기존 P2-04 모바일 진입 테스트 1건과 고객 목록 스냅샷 2건의 별도 조치, 독립 읽기 전용 재검수, 실제 스크린리더/실기기 확인. OBS02-R01은 별도 운영 이슈로 유지하며 이번에 조사·수정·원인 추정하지 않았다.

commit0 / push0 / PR0 / merge0 / deploy0 / Railway setting0 / production DB0 / P2-060.
Independent read-only re-audit required: YES.
