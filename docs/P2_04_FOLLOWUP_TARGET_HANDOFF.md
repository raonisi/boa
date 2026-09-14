# P2-04 빠른 후속등록 대상 고객 표시 — 독립 검수 인계

작업: `IMPLEMENT-P2-04-FOLLOWUP-TARGET-VISIBILITY-01`, 2026-09-14 Asia/Seoul.
구현자의 자체 검증 문서이며 독립 검수 PASS나 병합·배포 승인이 아니다.
**P2-04 IMPLEMENTATION CANDIDATE: PASS (자체 검증 범위). 독립 검수 미실시.**
최종 판정과 명령 결과는 아래 외부 `final-verification.json` 및 `candidate-manifest.json`과 함께 확인한다.

## 1. Base / candidate

- 저장소 `raonisi/boa`, 브랜치 `codex/p2-04-followup-target-visibility`.
- BASE_SHA = HEAD = 시작 시 새로 확인한 origin/main: `271be02ec99da5ade367bdb668f1fedc13739aa7`.
- 후보 작업 공간 `C:/work/boa-p2-04`. 원본 `C:/work/boa-main`의 파일·브랜치는 전환하지 않았다.
- 기반 이력: P2-01 `60ea312` (#166), P2-02 `6759697` (#167), Release Identity `1804a46` (#168), P2-03 `271be02` (#169).
- 최초 원본·후보 파일 변경 없음. 전용 worktree를 생성했고 reset/clean/stash를 사용하지 않았다.
- AGENTS.md(루트만 적용), boa-crm-full-build, docs/ops 작업·RBAC·QA·UI·E2E·보고 기준을 읽고 단일 에이전트로 수행했다.

## 2. 원 감사 요구

고객 상세 → 후속 → 빠른 후속 등록에서 선택 고객 이름이 보이지 않고 비활성 검색창과 2글자 안내가 남는 결함이다.
캐시 없는 첫 열기에서도 상세 고객과 같은 대상을 확인할 수 있어야 한다. ID가 전달되는 기존 코드만으로 잘못된 고객에게 저장됐다고 주장하지 않는다.

## 3. Current main root cause

`CustomerDetail.tsx`는 route의 `id`를 `defaultCustomerId`로 전달한다.
`FollowupQuickCreateDialog`는 이 값이 있으면 picker를 `disabled`로 만들었다.
picker의 `enabled: !disabled && (canSearch || value != null)` 때문에 선택 ID 조회도 꺼졌다.
서버 `customers.searchForSchedulePicker`는 이미 검색어 없는 `selectedCustomerId` 조회, 접근 검사, 삭제 제외, 마스킹 요약을 제공한다.

## 4. Pre-fix reproduction

제품 수정 전 `defaultCustomerId=101`, open, 캐시가 없을 때 enabled에만 응답하는 tRPC hook mock과 실제 dialog/picker를 렌더링했다.
`pre-fix-confirmed.log`: 기대 `enabled=true`, 실제 `false`로 1개 테스트 실패. 제품 수정 후 같은 assertion은 통과했다(`post-fix-repro.log`).
초기 harness 준비 2회 실패(`pre-fix.log`, `pre-fix-repro.log`: React global 및 Dialog composition mock 누락)는 제품 결함 재현 증거와 구분한다.
SSR은 네트워크·effect를 실행하지 않는다. 실제 GET/로딩/복구·이벤트·query cache 경합은 별도 브라우저 E2E로 검사했다.

## 5. 구현 설계

- `disabled`: 저장 중 상호작용 차단. `selectionLocked`: 지정 고객 검색·변경·해제 금지.
- 조회 조건: `value != null || (!disabled && !selectionLocked && canSearch)`. locked에서는 검색어를 보내지 않는다.
- locked + ID 없음: 불필요 조회 없이 확인 불가. editable 0–1자: 기존 안내, 2자 이상: 기존 debounce 검색.
- 기존 selected/items 중 **ID가 일치하는 요약만** 사용한다. 다른 ID인 selected 응답을 fallback으로 표시하지 않는다.
- 이름, 기존 maskedPhone/status/priority/assignedUserName을 읽기 전용 group으로 표시한다. locked 검색창·검색 결과·2글자 안내·X는 렌더링하지 않는다.
- 로딩은 status, 실패/null/불일치는 alert + 읽기 전용 refetch 버튼. 갱신 오류의 캐시 요약도 locked 정상 대상으로 표시하지 않는다.
- 검증된 ID를 작은 callback으로 dialog에 전달한다. 닫힘/해제 시 검증 상태를 비우고, default ID와 일치해야 등록 및 상세 입력을 허용한다. 버튼과 handler 모두 가드한다.
- default ID를 render 시점에 직접 사용해 route가 A→B로 바뀐 직후에도 reset effect를 기다리며 A를 사용하는 틈을 없앴다.
- 저장 중에도 조회와 이미 확인한 요약은 유지한다. 기존 30초 staleTime, query key, 인증 캐시 정책을 재사용했다. 새 cancellation/cache 체계는 없다.

## 6. Changed files

| 분류 | 파일 | 이유 |
|---|---|---|
| 제품 | `client/src/components/schedule/ScheduleCustomerLinkPicker.tsx` | selected 조회와 잠금 분리, ID 일치, read-only/loading/error/retry, 긴 이름 줄바꿈 |
| 제품 | `client/src/components/followups/FollowupQuickCreateDialog.tsx` | 잠금 전달, 후속 전용 안내, 대상 확인 전 등록/상세 입력 가드 |
| 테스트(신규) | `client/src/components/followups/FollowupQuickCreateDialog.test.tsx` | 원 결함 회귀, SSR 상태·query contract·잘못된 ID·masked 요약 |
| 테스트(신규) | `e2e/p2-04-followup-target.spec.ts` | 실제 화면, 캐시/응답 순서, 합성 mutation, editable, 반응형/키보드/axe |
| 테스트(확장) | `server/scheduleCustomerPicker.test.ts` | 기존 10개 보존 + 역할별 selected, 삭제, 인증/계정 상태 9개 추가 |
| 문서(신규) | 본 문서 | 범위·검증·후보 재현 인계 |

제품은 최초 제시한 2개 파일로 완료. 서버 변경 없음(`SERVER_CHANGE_JUSTIFICATION`: 해당 없음).
CustomerDetail, Calendar, ScheduleQuickCreateDialog, ScheduleChangeRequestDialog는 호출부만 확인했다.

## 7. Cache-empty first open

각 E2E는 새 page/context에서 CustomerDetail에 진입한다. picker 응답을 gate로 보류하여 실제 `selectedCustomerId=101, limit=20` 조회와 로딩, 두 버튼 차단을 먼저 확인한다.
gate 해제 후 이름·maskedPhone과 등록 가능 상태를 확인한다. 기존 캐시에 의존하지 않는다.

## 8. Customer identity consistency

상세 101 → picker 101 → quick payload 101; 상세 102 → picker 102 → detailed payload 102를 실제 UI에서 확인한다.
두 저장 테스트는 `mockBoaTrpc`가 응답하는 합성 `followUps.create`만 허용한다. 실제 DB 저장 성공이나 서버 저장 권한 검증으로 표현하지 않는다.
R01/R02는 A 조회 pending → 닫기 → client navigation B → B 표시 → 늦은 A 응답 완료 후에도 B 유지 검사다.
R03은 합성 mutation 응답을 보류해 저장 중 요약 유지 및 상세 입력 차단을 검사한다.

## 9. Editable picker regression

일정의 기존 빠른 등록과 고객 목록의 고객 미지정 빠른 후속 등록에서 0–1자 안내, 2자 조회, 선택, masked 요약, 결과 과다 안내, 연결 해제를 검사한다.
기존 일반 일정 설명은 유지했다. optional props 기본값으로 기존 Calendar/변경요청 picker의 편집 contract를 유지한다.

## 10. RBAC / masking

기존 서버 테스트 전부 보존. branch_admin/sub_branch_admin/team_leader/member의 허용 selected 조회와 maskedPhone, 범위 밖 null, 검색 범위·최소 길이, 삭제 제외를 확인했다.
비로그인 UNAUTHORIZED, inactive/resigned FORBIDDEN 및 고객 조회 미실행을 추가 검사했다.
이 endpoint의 서버 검증은 mocked DB 단위/router 검사다. critical은 별도로 실제 격리 MySQL에서 일정·알림 권한 회귀를 실행했다. 신규 P2-04 DB 통합검사를 실행했다고 주장하지 않는다.
기존 nullable teamId 관련 정책 검토 등 별도 backlog를 이번 작업에서 수정하거나 완료 처리하지 않는다.

## 11. T01–T16

| ID | 검증 근거 / 방식 |
|---|---|
| T01 | SSR hook enabled assertion + E2E selected GET |
| T02 | E2E cache-empty 응답 gate: loading → summary; SSR loading |
| T03 | SSR + E2E 이름 표시 |
| T04 | SSR + E2E 검색 input 없음 |
| T05 | SSR + E2E 2글자 안내 없음 |
| T06 | SSR + E2E unlink 없음 |
| T07 | locked 검색어 미전송 및 검색 UI 분기 미렌더링, E2E 입력/선택 버튼 없음 |
| T08 | SSR + E2E maskedPhone 유지, 원본 전화 미표시; 서버 마스킹 회귀 |
| T09 | SSR empty contract + 브라우저 0–1자 안내/미조회 |
| T10 | 두 editable 실제 화면 2자 debounce 조회·선택 |
| T11 | 두 editable 실제 화면 연결 해제 + SSR |
| T12 | SSR error/null/mismatched/cached-error + 브라우저 error/null/refetch |
| T13 | SSR + 브라우저 pending/error/null 등록·상세 입력 차단 |
| T14 | 실제 quick 화면 이벤트 → 합성 payload.customerId=101 |
| T15 | 실제 상세 전환 이벤트 → 합성 상세 payload.customerId=102 |
| T16 | client navigation과 늦은 A 실제 응답 후 B 유지 |

이벤트·effect·query cache 검증은 실제 브라우저의 component integration/E2E에 포함한다. 이를 SSR 단위 테스트만으로 검증했다고 하지 않는다.

## 12. P204-01–08

| ID | 검증 |
|---|---|
| P204-01 | 1440×900 캐시 없는 실제 CustomerDetail 첫 열기 |
| P204-02 | 390×844 동일 경로 |
| P204-03 | 320×740 긴 합성 이름·담당자명, 넘침/가림·버튼 크기 |
| P204-04 | close/reopen 같은 A, 검증 상태 복구 |
| P204-05 | A→B query key 및 늦은 A 응답 |
| P204-06 | 오류/null 상태·차단·키보드 재시도 |
| P204-07 | 일정과 고객 미지정 후속 편집 경로 회귀 |
| P204-08 | 읽기 smoke의 모든 POST/PATCH/DELETE=0 assertion; 별도 합성 submit 2건만 허용 |

## 13. Responsive

1440×900 / 390×844 / 320×740 CSS px. 모달·대상 카드 scrollWidth/clientWidth 차이 ≤1px, 화면 좌우 경계 안, 카드 하단이 sticky submit 위에 위치함을 측정했다.
390/320의 등록·상세 입력·닫기 버튼 각각 44×44px 이상 검사. 긴 이름은 줄바꿈하고, 연락처·담당자도 카드 안에서 줄바꿈한다.
`p204-final-results/**/target-*.png`, Playwright JSON의 layout attachment를 확인한다. 물리 휴대폰·모바일 OS 키보드·실제 스크린리더 검증은 미실시다.

## 14. Accessibility

대상 `role=group`/accessible name과 일반 텍스트 고객명, loading `role=status`, error `role=alert`, 재시도 버튼 이름을 제공한다.
선택 변경 control을 DOM에서 제거해 tab stop도 없다. Tab이 dialog 안에 유지되고 Escape로 닫힘, retry Enter 동작을 확인한다.
대상 group에 대한 axe 검사 + 저장소 공식 accessibility suite를 실행한다. 공식 suite의 기존 baseline 허용분은 삭제/확대하지 않았으며 전체 앱의 모든 WCAG 결함이 0이라는 주장이 아니다.

## 15. Quality commands / evidence

증거 루트: `C:/work/boa-p204-implementation-20260914-q6fz6x`.
모든 실제 명령·시작/종료·exit·환경 요약은 `*.command.json`, 원문 출력은 대응 `*.log`에 있다.
`final-verification.json`에 최종 명령·결과를 집계한다. 다음은 사용한 저장소 scripts다.

| 구분 | 실제 script/인수 (Windows pnpm.cmd) |
|---|---|
| 타입 | `check` |
| 전체 단위 | `test` |
| 표적 | `test client/src/components/followups/FollowupQuickCreateDialog.test.tsx server/scheduleCustomerPicker.test.ts server/followupQuickCreate.test.ts server/scheduleQuickCreate.test.ts` |
| 빌드/예산 | `build`, `bundle:check` |
| P2-04/P2-03 | `test:e2e e2e/p2-04-followup-target.spec.ts e2e/p2-03-today-overdue.spec.ts --project=desktop-chromium --workers=1` (뷰포트는 spec에서 명시) |
| P2-01/P2-02 | `test:e2e e2e/customer-assign-query-state.spec.ts e2e/customer-list-count-sort.spec.ts --workers=1` (기존 3 projects) |
| critical | `test:e2e:critical` |
| 접근성 | `test:e2e:accessibility` |
| core | `test:e2e:smoke` (기존 3 projects) |

E2E 각 명령에는 고유 외부 `--output=... --reporter=list,json`과 JSON 경로를 추가했다. 전체 argv는 command record에 있다.
Node 24.15.0 / pnpm 10.4.1. package/lock byte 동일성을 확인한 기존 설치의 node_modules junction 사용. 의존성·script 변경 없음.
실행 환경은 OS 경로 관련 변수만 허용하여 재구성; .env 파일 없음; DB 미설정 또는 `127.0.0.1:33424/boa_e2e`만 연결.
MySQL 8.4.9 새 datadir/loopback/UTC를 검증한 후 기존 migration과 합성 seed를 실행했다. OS/운영 시각은 변경하지 않았다. `mysql-isolation.json`, `mysql-stopped.json` 참조.
실제 외부 자격증명·Firebase 설정은 상속하지 않았고 scheduler는 껐다. 합성 계정 JWT는 출력하지 않았다.

## 16. A01–A18 판정 연결

각 항목의 최종 PASS/FAIL/HOLD는 `final-verification.json`의 acceptance에 명시한다.

| ID | 근거 |
|---|---|
| A01 | T02/P204-01~03 |
| A02 | T01/T14/T15/T16 |
| A03 | T03 |
| A04 | T04 |
| A05 | T05 |
| A06 | T06/T07 |
| A07 | 실제 selected 조회 input 기록 |
| A08 | T02/T12 |
| A09 | T13 |
| A10 | T14 |
| A11 | T15 |
| A12 | T16/R01/R02 |
| A13 | T09~11/P204-07 |
| A14 | 서버 picker 19개 + 기존 권한 회귀 |
| A15 | 세 뷰포트 screenshot/layout/touch bounds |
| A16 | targeted axe/keyboard + 공식 접근성 |
| A17 | 최종 Quality 명령 결과 |
| A18 | P2-01~03/core/critical 및 제품 diff 범위 |

## 17. P2-01–P2-03 regression / 영향

DB 배정 조회 오류·빈 상태·재시도·배정 차단, 고객 count/filter/sort, 오늘/기한경과의 기존 spec을 그대로 실행했다.
API URL·input/output·서버 mutation, 고객 RBAC·분류·추천 계산/정렬·DB schema/migration·알림 정책·Release Identity·workflow 변경 0.
별도 코드 전수 감사나 production smoke를 수행하지 않았다.

## 18. Candidate identity / patches

외부 `candidate-manifest.json`: BASE/HEAD/branch, staged/unstaged/untracked 구분, 전체 6파일 raw SHA-256 및 Git canonical blob, candidate ID, 각 patch hash.
`candidate-full.patch` / `candidate-product.patch` / `candidate-tests.patch`는 신규 파일 내용까지 포함한다. 실제 index를 변경하지 않은 임시 Git index로 생성한다.
`verify-candidate.cjs`는 재검수 시 현재 파일 및 patch hash를 재확인한다. HEAD만으로 미커밋 후보를 식별하지 않는다.
문서 자체 해시는 외부 manifest에 포함해 순환 참조를 피했다. freeze 이후 변경 시 manifest와 검사 증거를 새로 생성해야 한다.
임시 runner/기존 빌드 산출물/quality-results/node_modules는 제품 후보에서 제외하며, 외부 도구와 로그는 검수 재현 자료로 구분한다. private MySQL datadir와 인증 state는 인계에 포함하지 않는다.

## 19. 제한 / backlog / 복귀

- 독립 읽기 전용 재검수 **미실시**. 다음 작업은 이 후보의 독립 검수다.
- 운영/실기기/스크린리더 결과 미검증. mock submit을 실제 저장 성공으로 해석하지 않는다.
- 초기 E2E 6실패는 실제 UI 버튼명과 화면 크기가 맞지 않은 테스트 선택자 문제였고 assertion/timeout/skip 변경 없이 바로잡았다. 이전 로그는 보존했다.
- 기존 접근성 baseline, 빌드 chunk 경고, KST host + MySQL SYSTEM 조합 N04 backlog는 이 작업의 해결 대상으로 삼지 않았다. 이번 critical은 명시한 CI와 동등한 UTC 환경 결과다.
- 복귀: 미커밋 전용 worktree를 그대로 보존하거나, 이후 새 수정이 없는지 manifest를 확인한 뒤 해당 후보 patch만 되돌리는 별도 작업을 수행한다. DB 되돌림·migration 불필요. 자동 reset/clean은 하지 않는다.

## 20. 수행 금지 확인

commit 0 / push 0 / PR 생성 0 / merge 0 / deploy 0 / Railway 설정 0 / production DB read·write 0 / 실제 외부 발송 0 / P2-05 0.
독립 재검수용 인계까지만 수행한다.

## 최종 실행 결과 (후보 고정 시점)

T01–T16 / P204-01–08 / A01–A18: 모두 PASS (위 표의 SSR·브라우저·서버 mock·실제 DB 검증 방식 구분 적용).

| 명령 묶음 | 실제 결과 |
|---|---|
| check-final | exit 0; 성공 |
| unit | exit 0;  Test Files  114 passed (114);      Tests  1204 passed (1204) |
| targeted-final | exit 0;  Test Files  4 passed (4);      Tests  40 passed (40) |
| build | exit 0; 성공 |
| bundle | exit 0; PASS entry JS gzip: 171.4 KiB / 174.1 KiB (baseline 165.8 KiB);PASS largest JS chunk gzip: 232.8 KiB / 244.4 KiB (baseline 232.8 KiB);PASS total JS gzip: 793.2 KiB / 826.0 KiB (baseline 786.7 KiB);PASS total CSS gzip: 32.5 KiB / 34.1 KiB (baseline 32.5 KiB);Bundle: entry 900.4 KiB raw / 171.4 KiB gzip; largest 699.1 KiB raw / 232.8 KiB gzip; total JS 3223.8 KiB raw / 793.2 KiB gzip; CSS 231.8 KiB raw / 32.5 KiB gzip |
| p204-final-strengthened | exit 0;   10 passed (1.3m) |
| p204-final | exit 0;   22 passed (1.9m) |
| regression-p201-p202 | exit 0;   96 passed (10.4m) |
| db-critical | exit 0;   12 passed (1.4m) |
| db-accessibility | exit 0;   16 passed (2.6m) |
| core-smoke | exit 0;   9 skipped;  87 passed (4.1m) |

core의 9 skip은 원래의 desktop-only 1건 및 mobile-only 4건의 project 분기다. 새 skip 0. P2-01 63 + P2-02 33 = 96 PASS; P2-03 12 PASS; 최종 P2-04 10 PASS.
최종 P2-04 화면/측정은 `p204-final-strengthened-results`의 screenshot/layout attachment가 우선이다.
