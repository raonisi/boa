RI01-R01 AMBIENT DECLARATION FIX: **PASS**

RAILWAY NATIVE RELEASE IDENTITY OVERALL CANDIDATE: **PASS — 로컬 구현자 자체 검증 범위**

## 2026-09-13 RI01-R01 한정 수정 · 새 독립 재검수 인계

작업명 `FIX-RAILWAY-NATIVE-RELEASE-IDENTITY-RI01-R01-01`. 새 후보 독립 재검수는 **미실시**다. 이전 독립 검수의 ambient 결함을 수정한 자체 결과이며, 운영 배포 또는 GitHub CI PASS를 의미하지 않는다. 아래의 RI-01/2026-09-10 구간은 역사 기록이다.

- root: `C:/work/boa-native-release-identity-ri01-r01`
- branch: `codex/ri01-r01-ambient`
- BASE_SHA = HEAD = `675969747b8e045ef46e5a3c8fd3e655030ebe2d`; 시작 시 remote main도 동일. P2-01/P2-02가 포함된 기준이며 미커밋 Release Identity 변경은 별도 patch에 포함된다.
- 이전 후보 `e5e936de69853115ebf6e417571087ae3d1b3e57c532a5a4cc246380cf43d608`의 파일 7개 및 보존 파일 해시를 확인하고 새 worktree로 복사했다. 원본 main과 이전 후보를 수정하지 않았다.
- 적용 지시는 사용자 RI01-R01 master, root AGENTS, 기존 BOA skill 및 workflow/evidence 정책이다. 추가 경로 AGENTS 없음. 단일 agent의 제한 수정으로 진행했다.

원인은 AST에서 export/const/literal만 검사하고 `declare`와 declaration-file context를 제외하지 않은 것이다. typed/untyped ambient 선언은 syntax parsing이 성공해도 runtime identity를 emit하지 않는다. 이전 AST 전환에서 생긴 preparation 회귀이며, 기존 runtime 신원 위조 승인으로 표현하지 않는다.

제품 수정 전 새 fixture 26개에서 **21 PASS / 5 FAIL**을 실제 재현했다. C01·C02·C05·E05 및 `.d.*` 추가 경계에서 실패했다. C01/C02는 같은 ambient 원인의 두 표현이고 `.d.ts`는 filename을 고정해서 읽던 문맥 누락이다. `pre-ambient.log`와 `pre-fix/`에 수정 전 실행 결과/이전 소스를 보존했다.

| 구분 | 파일 | 이번 R01 변경 |
|---|---|---|
| 제품 1개 | `scripts/prepare-release-identity.mjs` | 실제 fileName 전달, declaration-file 및 DeclareKeyword/Ambient guard |
| 테스트 수정 | `scripts/prepare-release-identity.test.mjs` | ambient suite import 1줄. 기존 64개 assertion 유지 |
| 테스트 신규 | `scripts/prepare-release-identity.ambient.test.mjs` | C20/E5 및 declaration-file 경계 1개, 총 26 tests |
| 문서 | 이 문서 | 현재 원인·실행·후보 식별 인계 추가 |

`production-deploy-gate.test.mjs`는 이번에 변경하지 않았다. 기존 gate→prepare test→ambient test 연결로 새 검사를 실행한다. 이전 후보의 package build 연결, runtime appVersion/provenance test, stamp helper, routes, workflow, lockfile은 bytes 그대로다. BASE 대비 전체 후보는 이전 미커밋 수정까지 **제품3·테스트4·문서1 = 8파일**이다. R01 delta는 위 4파일만 포함한다.

### 판독 규칙과 API 확인

기존 pure reader와 TypeScript AST를 유지한다. `readPreStampedReleaseIdentity(source, fileName="releaseIdentity.ts")`의 기존 1인자 호출은 그대로 동작한다. preparation은 실제 outputPath를 전달하며 `sourceFile.isDeclarationFile`을 거부한다. `.d.ts/.d.mts/.d.cts`를 검사했다.

기존 direct top-level exported const identity 선언을 **먼저 센다**. 두 개 이상이면 값이나 ambient 여부에 관계없이 기존 `ambiguous`다. 유일한 선언만 DeclareKeyword 및 `getCombinedModifierFlags(declaration) & ModifierFlags.Ambient`를 검사해 invalid로 거부한다. 정상+ambient, development+ambient의 중복을 걸러낸 뒤 정상 값만 선택하는 방식으로 바꾸지 않았다.

설치된 TypeScript 5.9.3의 실제 구현은 modifier flags를 declaration→declarationList→variableStatement에서 합친다. `typescript-api-and-emit.json`은 설치 API의 선언 문맥·flag·실제 emit 결과를 기록한다. 제품 판정에는 transpile/import/eval을 사용하지 않는다. emit은 독립된 합성 증거다.

기존 정확한 const kind(Using/AwaitUsing 제외), identifier 원문, actual string literal, lowercase 40자리 raw SHA, Unicode 비정상값 거부를 보존했다. missing/invalid는 Railway에서 `RAILWAY_RELEASE_IDENTITY_MISSING`, 중복은 `RAILWAY_RELEASE_IDENTITY_AMBIGUOUS`, CLI exit1이다. 오류에 source·invalid 값·env 원문을 넣지 않는다.

valid native env SHA의 canonical stamp+verify는 여전히 파일 읽기/파싱보다 먼저 실행된다. ambient/malformed/development/missing/stale stamp 모두 기존 정책을 유지한다. `.d.*` output에도 승인된 native stamp 쓰기 우선순위를 보존하며, 그 확장자 파일의 후속 bundle 성공을 주장하지 않는다. 기본 실제 generated 경로는 `.ts`다. valid pre-stamp와 local no-op는 재출력하지 않는다.

### C01~C20 / E01~E05

모든 행 PASS. 거부 사례의 PASS는 예상한 fail-closed를 확인했다는 뜻이다.

| ID | 결과 |
|---|---|
| C01 | typed export declare → invalid/MISSING |
| C02 | untyped export declare → invalid/MISSING |
| C03 | 초기값 없는 declare → invalid/MISSING |
| C04 | declare + export list → missing/MISSING |
| C05 | `.d.ts`의 type 선언 및 literal 선언 모두 invalid/MISSING |
| C06 | ambient module 내부 → missing/MISSING |
| C07 | namespace 내부 → missing/MISSING |
| C08 | 정상 runtime const → pre-stamped/bytes 보존 |
| C09 | 정상 값 + block 예제 → 보존 |
| C10 | 정상 값 + line 예제 → 보존 |
| C11 | CRLF·공백·single quote → 전체 Buffer/SHA-256 보존 |
| C12 | development + ambient → ambiguous |
| C13 | development + ambient + 주석 → ambiguous |
| C14 | valid env + ambient → exact canonical stamp+verify |
| C15 | valid env + malformed ambient → exact stamp+verify |
| C16 | runtime 선언 2개 → ambiguous |
| C17 | runtime + ambient 선언 → ambiguous |
| C18 | ambient + development → ambiguous |
| C19 | `as const` initializer → invalid, 새 허용 없음 |
| C20 | 괄호·연결·동적 호출 → invalid |
| E01 | 실제 TS emit의 정상 runtime export 존재 |
| E02 | typed/untyped export declare의 emitted runtime export 없음 |
| E03 | ambient module의 emitted runtime export 없음 |
| E04 | 보존된 정상 fixture를 실제 appVersion import 경로로 esbuild 성공 |
| E05 | ambient 및 `.d.ts` CLI exit1; preparation에서 거부되어 bundle 호출 0회 |

추가 `.d.ts/.d.mts/.d.cts` 1개 test의 세 분기는 env 없는 거부 및 valid env stamp 우선순위를 모두 통과했다. E emit 및 bundle 검사에는 합성 source만 사용했고 실행하지 않았다.

### A/B/I/Q 재검증

이전 검수자의 oracle를 **byte 동일하게 복사**하고 harness의 후보 root와 후보 식별 참조만 변경했다. assertion/timeout/fixture 기대값은 그대로다. 이전 검수의 C01~C16 이름과 이번 master의 C01~C20 이름은 서로 다른 목록이다. `prior-review-replay/harness-adaptation.json`에 구분·해시를 기록했다. 이번 재실행은 독립 검수로 부르지 않는다.

**A01~A18: 18/18 PASS(22 fixtures), B01~B10: 10/10 PASS(19 fixtures).** `ab-matrix.json`에 각 ID와 하위 fixture 실제 CLI payload·before/after hash가 있다. 전체 과거 검수 suite는 추가 C/N/env/marker 포함 **64/64 PASS**다. 과거 FAIL이던 ambient도 현재 거부한다.

| ID | 판정·근거 |
|---|---|
| I01 | PASS — local no-op 및 실제 build development-noop |
| I02 | PASS — native exact stamp+verify, A15/A17/N01~N05/C14~C15 |
| I03 | PASS — invalid env 7값 거부/bytes·sentinel 보호 |
| I04 | PASS — 실제 pre-stamp Buffer/SHA-256 보존 |
| I05 | PASS — marker 3개, A/B, declare/ambient/.d.* 거부 |
| I06 | PASS — production stamp/runtime 없음 → 200 |
| I07 | PASS — matching runtime → 200 |
| I08 | PASS — 동일 short prefix의 다른 full SHA → null/503 |
| I09 | PASS — production env-only → null/503 |
| I10 | PASS — non-production fallback 및 우선순위 유지 |
| I11 | PASS — 실제 stamp→prepare→verify CLI exit0/0/0, 같은 bytes |
| I12 | PASS — build 전후 source/generated/lock/workflow 보존 |

| ID | 판정·근거 |
|---|---|
| Q01 | PASS — 새 manifest의 8파일 및 full/R01 patch 대조 |
| Q02 | PASS — direct top-level AST 판독 유지 |
| Q03 | PASS — A01/A02/B01/B02 comment 거부 |
| Q04 | PASS — A03/A04/B03/B04 string/template 거부 |
| Q05 | PASS — C01~C20 및 E01~E05의 runtime 값 규칙 |
| Q06 | PASS — runtime/ambient 혼합까지 duplicate 정책 유지 |
| Q07 | PASS — malformed/Unicode 및 ambient negative |
| Q08 | PASS — C08~C11/A05~A08/CLI chain byte 보존 |
| Q09 | PASS — native env 우선 canonical stamp+verify |
| Q10 | PASS — 실제 local build 및 generated hygiene |
| Q11 | PASS — targeted 11개 및 합성 bundle HTTP 9개 |
| Q12 | PASS — temp CLI 3단계, production workflow 불변 |
| Q13 | PASS — I01~I12 모두 재실행 |
| Q14 | PASS — 아래 필수 명령과 negative 모두 통과 |
| Q15 | PASS — 구현 후 검증 중 코드7파일 불변/원본·이전 후보 보존. 이번 구현 자체를 읽기 전용으로 표현하지 않음 |

### 실제 명령·증거·한계

증거 root: `C:/work/boa-ri01-r01-evidence-20260913`. Node v24.15.0/pnpm 10.4.1, 고정 lockfile 설치 성공. 실제 `.env` 없음, OS 경로 allowlist·빈 DATABASE_URL·합성 환경으로 실행했다. 각 JSON/`commands-summary.json`에 cwd·executable·argv·exit·pass/fail/skip·log를 기록한다. pnpm은 cmd.exe를 통해 실행했으며 requestedArgv와 실제 wrapper argv를 구분한다.

| 명령 | 결과 | 로그 |
|---|---|---|
| `node --test scripts/prepare-release-identity.ambient.test.mjs` 수정 전 | exit1 / 21 PASS, 5 FAIL, 0 skip | `pre-ambient.log` |
| 동일 ambient 명령 수정 후 | exit0 / 26 PASS, 0 FAIL, 0 skip | `post-ambient.log` |
| `node --test scripts/prepare-release-identity.test.mjs` | exit0 / 90 PASS | `final-parser.log` |
| `node --test scripts/production-deploy-gate.test.mjs` | exit0 / 175 PASS | `final-gate.log` |
| `node --test <증거>/prior-review-replay/prior-review-fixtures.test.mjs` | exit0 / 64 PASS | `final-prior-fixtures.log` |
| `pnpm.cmd test server/_core/appVersion.test.ts server/_core/appVersion.provenance.test.ts` | exit0 / 11 PASS | `final-runtime.log` |
| `pnpm.cmd check` | exit0 / PASS | `final-check.log` |
| `pnpm.cmd test` | exit0 / 113 files, 1,165 PASS | `final-test.log` |
| `pnpm.cmd build` | exit0 / development-noop·vite/esbuild 성공 | `final-build.log` |
| `node <증거>/artifact-proof.cjs <증거>/artifact-run` | exit0 / 9 HTTP 조합 PASS | `final-artifact.log` |
| `node <증거>/direct-chain.cjs` | exit0 / CLI 3단계 PASS | `final-direct-chain.log` |

26개는 90개에, 90개는 175개에, targeted 11개는 Vitest 1,165개에 포함된다. 서로 더해서 고유 검사 수로 주장하지 않는다. 900KB chunk 경고는 기존대로 남아 있고 baseline을 바꾸지 않았다. 서버/API runtime 조건 검증은 합성 bundle과 loopback HTTP이며 운영 배포 성공이 아니다.

`candidate-manifest.json`/`candidate.patch`/`r01-only.patch`/`final.json`은 새 후보 및 hash를 고정한다. `candidate-files/`는 EOL 변환과 구분할 8개 원본 bytes, `evidence-manifest.json`은 로그·fixture·도구 해시다. `verify-candidate.cjs`로 HEAD·파일/보존 해시·patch reverse check·이전 후보 불변을 읽기 전용으로 확인한다. HEAD만으로 미커밋 후보를 식별하지 않는다.

staged 0, unstaged 3(package/gate test/appVersion), untracked 5(prepare/prepare test/ambient test/provenance test/이 문서)다. 설치·빌드 `node_modules/`, `dist/`는 patch에서 제외했다. 새 근거는 별도 root에 보관해 이전 증거를 덮어쓰지 않는다. 고정 후 후보 파일은 추가 수정하지 않는다.

API field 계약·DB/schema/migration·RBAC·F01/F02/F03/RF02/P2 코드는 이번에 바꾸지 않았다. 실제 고객/운영 DB/외부 발송/비밀값은 사용하지 않았다. GitHub 후보 CI·브라우저 E2E·실기기·실제 Railway 검증은 미실행이다. 독립 재검수의 초점은 ambient/filename guard, 혼합 중복 정책, native 우선순위, 원본 bytes, 기존 runtime guard 보존이다.

원본 main과 이전 후보가 남아 있으므로 운영 복귀 조치는 필요 없다. 철회가 필요하면 동시 변경을 확인한 후 R01 delta만 별도 작업으로 철회한다. reset/clean/stash 및 commit/push/PR/merge/deploy, Railway/Wait for CI/PRODUCTION_DEPLOY_ENABLED 변경, P2-03 수행 없음.

## 이전 RI-01 인계 기록 — 현재 후보 검증 근거로 재사용하지 않음

# FIX-RAILWAY-NATIVE-RELEASE-IDENTITY-RI01-01 · 독립 재검수 인계

RI-01 PRE-STAMP PARSER FIX: **PASS — 2026-09-13 구현자 자체 검증 범위**

새 후보의 독립 재검수: **미실시**. 기존 후보의 독립 검수에서 발견된 RI-01을 이번에 수정했다. GitHub 후보 CI·병합·Railway 배포·설정 변경은 하지 않았다. 아래 2026-09-10 기록은 과거 증거이며 현재 PASS 근거로 재사용하지 않는다.

## RI-01 현재 기준·원인·범위

- 경로: `C:/work/boa-native-release-identity-ri01`, 브랜치: `codex/ri01-prestamp-parser`.
- BASE_SHA = HEAD = `675969747b8e045ef46e5a3c8fd3e655030ebe2d`. 원격 main도 같은 SHA임을 `git ls-remote origin refs/heads/main`으로 확인했다.
- P2-01 merge `60ea31217c8901b8f5fcb9aacee3a5fb9fbe8f83`가 조상이고 BASE는 P2-02 merge다. **이 HEAD 자체에는 미커밋 Release Identity 변경이 포함되지 않는다.** 전체 candidate patch와 파일 hash를 함께 확인해야 한다.
- 이전 후보 ID `4f844b655c375d9c8a41911fcddf8616f17fa0a0fdc2b9e628b9c369766e5597`의 6개 파일 및 보존 파일 hash를 확인한 후 별도 worktree로 복사했다. 이전 후보와 원본 main은 그대로 유지했다.
- 파일 전체의 줄 정규식이 block comment/template 안의 export를 실제 선언으로 오인했다. 실제 stamp가 development여도 preparation이 성공하는 결함이다. 기존 runtime의 null/health503 차단은 유지되어, runtime 신원 위조 승인으로 분류하지 않는다.
- 제품 수정 전에 동일 합성 RI01-01~14를 실행해 **11 PASS / 3 FAIL**을 재현했다. 실패는 RI01-01(block), RI01-04(template), RI01-09(duplicate)의 `Missing expected rejection`이다.

| 구분 | 파일 | 이번 RI-01 변경 |
|---|---|---|
| 제품 1개 | `scripts/prepare-release-identity.mjs` | 정규식 판독을 pure AST helper로 교체, 중복·파싱 오류 차단 |
| 테스트 수정 | `scripts/production-deploy-gate.test.mjs` | 새 집중 테스트를 import하여 기존 CI 실행 경로에 포함. 기존 assertion 그대로 |
| 테스트 신규 | `scripts/prepare-release-identity.test.mjs` | RI14, parser48, 거부 fixture 통합·CLI2 = 64개 |
| 문서 수정 | 이 문서 | 이번 수정·새 실행 결과·검수본 식별 안내 추가 |

이전 후보에서 승계한 `package.json`, `server/_core/appVersion.ts`, `server/_core/appVersion.provenance.test.ts`는 byte hash가 그대로다. BASE 대비 전체 후보는 제품 3개·테스트 3개·문서 1개, 총 7개 파일이며 RI-01 순수 변경은 위 4개다.

## AST 판독과 오류 정책

기존 devDependency TypeScript **5.9.3**의 `createSourceFile`로 소스만 파싱한다. API 사용 근거는 [TypeScript Compiler API 공식 문서](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)와 설치된 `typescript.d.ts`다. dependency·lockfile 변경은 없다.

1. source-file의 직접 `statements` 중 exported variable statement만 검사한다. 하위 namespace/function/block은 탐색하지 않는다.
2. declaration-list의 BlockScoped 종류가 정확히 Const인 경우만 인정한다. `let`, `var`, `using`, `await using`은 제외한다.
3. 식별자 `RELEASE_SHA` 선언을 먼저 모두 센다. 실제 선언이 2개 이상이면 값과 무관하게 `ambiguous`이며 Railway에서는 `RAILWAY_RELEASE_IDENTITY_AMBIGUOUS`, CLI exit1이다.
4. 유일한 선언의 실제 식별자 철자와 string-literal initializer만 인정한다. literal의 raw contents를 기존 `validateReleaseSha`로 검사한다. 따옴표만 제거하며 trim·case 변환·Unicode escape decoding으로 값을 정상화하지 않는다.
5. syntax parse diagnostic이 있으면 `invalid`다. invalid/missing은 Railway에서 기존 `RAILWAY_RELEASE_IDENTITY_MISSING`, CLI exit1이다. 원문이나 diagnostic 내용은 로그에 넣지 않는다.
6. valid native env SHA의 stamp→verify 경로는 **기존 파일 읽기/AST 판독보다 먼저** 실행한다. malformed/duplicate/throw 문구가 있는 이전 파일이나 missing file도 정확한 native stamp로 교체된다. 잘못된 env SHA는 기존 `INVALID_RELEASE_SHA`를 유지한다.
7. valid pre-stamp는 쓰기·직렬화 없이 보존한다. 로컬에서 valid stamp가 없는 경우도 기존 no-op을 유지한다. 소스를 import/eval하여 identity를 판정하지 않는다. 이는 identity 구문 판독이며 전체 모듈의 의미·타입 검증을 대체하지 않는다.

## RI01-01~14 실제 결과

여기서 PASS는 기대한 **거부 또는 보존**이 확인되었다는 뜻이다. 모든 입력은 합성 fixture이며 temp output만 쓴다.

| ID | 수정 전 | 수정 후 | 검증 |
|---|---|---|---|
| RI01-01 | FAIL | PASS | actual development + block comment → missing 거부 |
| RI01-02 | PASS | PASS | line comment → missing 거부 |
| RI01-03 | PASS | PASS | quoted export 문자열 → missing 거부 |
| RI01-04 | FAIL | PASS | template export → missing 거부 |
| RI01-05 | PASS | PASS | actual valid + 다른 SHA 주석 → byte 보존 |
| RI01-06 | PASS | PASS | valid CRLF → byte 보존 |
| RI01-07 | PASS | PASS | canonical → byte 보존 |
| RI01-08 | PASS | PASS | non-export SHA + actual development → 거부 |
| RI01-09 | FAIL | PASS | duplicate exported const → ambiguous 거부 |
| RI01-10 | PASS | PASS | uppercase·39·41자리 → 거부 |
| RI01-11 | PASS | PASS | dynamic initializer → 거부 |
| RI01-12 | PASS | PASS | valid env + commented/duplicate/malformed/throw source → exact stamp+verify |
| RI01-13 | PASS | PASS | local development → no-op·byte 보존 |
| RI01-14 | PASS | PASS | missing file/parent + native SHA → 기존 helper가 생성·verify |

추가 pure parser 48개는 거부 42개와 유효 선언 6개다. 거부 42개는 실제 preparation에서도 Railway 차단 및 local no-op·byte 보존을 확인했다. CLI는 block/template/duplicate/parse-error/escaped SHA 5조건에서 exit1·고정 JSON·SHA/합성 source/env sentinel 비노출을 확인했다. 유효 SHA prefix+suffix, zero-width, Unicode lookalike, Unicode/hex escapes, escaped identifier, object property, nested declaration, export list, destructuring 등을 포함한다.

초기 AST 구현에서 `await using`이 Const 비트를 공유하는 추가 경계 실패를 발견했다(`const-adversarial.log`). 단순 비트 포함 검사 대신 declaration kind의 정확한 일치를 사용한 후, 관련 테스트를 유지한 최종 64개가 모두 통과했다.

## I01~I12 이번 재실행

| ID | 판정 | 현재 증거 |
|---|---|---|
| I01 | PASS | temp local no-op 및 실제 build `development-noop` |
| I02 | PASS | native exact stamp+verify, 기존 stale stamp 교체 |
| I03 | PASS | invalid native env 거부·byte 보존·CLI 비노출 |
| I04 | PASS | canonical/LF/CRLF/comments 보존 |
| I05 | PASS | 세 Railway marker 누락 차단 및 강화한 RI negative/CLI |
| I06 | PASS | valid stamp + runtime SHA 없음 → 200 |
| I07 | PASS | matching full SHA → 200 |
| I08 | PASS | 같은 short prefix의 다른 full SHA → null/503 |
| I09 | PASS | unstamped production env-only → null/503 |
| I10 | PASS | non-production fallback·우선순위 유지 |
| I11 | PASS | 기존 direct stamp→prepare→verify 통과, workflow hash 보존 |
| I12 | PASS | 실제 build 전후 generated·lock·workflow hash 및 git status 보존 |

I06~I10은 기존 targeted Vitest 및 후보 metadata/routes를 esbuild한 9개 loopback HTTP 조합으로 확인했다. provenance fixture의 module 실행은 **합성 runtime 검증 단계**이며, 제품 pre-stamp 판독에는 실행을 사용하지 않는다. 실제 Railway/운영 DB 검증이 아니다.

## 이번 실제 명령·증거

증거 루트: `C:/work/boa-native-release-identity-ri01-evidence-20260913`. 아래 명령은 현재 새 worktree에서 실행했다. Node `v24.15.0`, pnpm `10.4.1`, `.env` 없음, OS 경로만 허용한 실행기·빈 DATABASE_URL·합성 환경 사용. 실제 고객·토큰·비밀값은 사용하지 않았다.

| 명령 | exit / 결과 | 로그 |
|---|---|---|
| `node --test scripts/prepare-release-identity.test.mjs` 수정 전 | 1 / 11 PASS, 3 FAIL | `pre-fix-ri01.log` |
| `node --test scripts/prepare-release-identity.test.mjs` 최종 | 0 / 64 PASS, 0 FAIL, 0 skip | `final-ri01.log` |
| `node --test scripts/production-deploy-gate.test.mjs` | 0 / 149 PASS, 0 FAIL, 0 skip | `final-release-node.log` |
| `pnpm.cmd test server/_core/appVersion.test.ts server/_core/appVersion.provenance.test.ts` | 0 / 11 PASS | `final-runtime.log` |
| `pnpm.cmd check` | 0 / PASS | `final-check.log` |
| `pnpm.cmd test` | 0 / 113 files, 1,165 PASS | `final-test.log` |
| `pnpm.cmd build` | 0 / preparation development-noop, vite/esbuild 성공 | `final-build.log` |
| `node <증거루트>/artifact-proof.cjs <증거루트>/artifact-run` | 0 / 9 HTTP 조합 PASS | `final-artifact.log`, `artifact-run/artifact-proof.json` |

149개 Node 검사에는 집중 64개가 포함되고, 전체 Vitest에는 targeted 11개가 포함된다. 합쳐서 별도 고유 테스트 수로 주장하지 않는다. 오프라인 설치는 캐시 누락 exit1, `pnpm.cmd install --frozen-lockfile --ignore-scripts` 재시도는 exit0이다. Vite의 기존 900KB chunk 경고는 남아 있고 기준을 바꾸지 않았다. 탐색 중 cmd 인용 오류 1건은 단순 심볼 검색으로 대체했으며 제품 검사와 구분한다.

`hygiene-before.json`/`hygiene-after.json`은 generated SHA-256 `e78e21ce63ab6cacc7f5a463d1f1dcfad21b7175fc282922ff14e2edf9b7fdb7`의 불변과 generated dirty 없음, 이전 후보 불변을 기록한다. 수정 전 원본 스크립트와 같은 14 fixture는 `pre-fix-reproduction/`에 보존했다. 이 경로의 Node test를 재실행한 `pre-fix-replay.log`에서도 같은 3개 실패를 확인했다.

## 새 후보 고정·독립 재검수 절차

- `candidate-manifest.json`: BASE/HEAD/branch, 전체 7파일 상태·bytes·SHA-256, candidate ID, 전체 및 RI-only patch hash.
- `candidate.patch`: BASE 대비 이전 Release Identity 수정과 이번 RI-01을 모두 포함. untracked 4파일도 포함한다.
- `ri01-only.patch`: 이전 후보 대비 이번 제품1·테스트2·문서1 변경만 포함.
- `candidate-files/`: manifest의 7개 파일 원본 bytes. Windows Git EOL 변환과 구분해 정확한 후보를 재구성할 수 있다.
- `final.json`, `evidence-manifest.json`: 최종 판정·패치/manifest 해시 및 로그/보조 도구 해시.
- `verify-candidate.cjs`: HEAD·파일 hash·이전 후보 불변·staged 없음 확인. 파일 수정 없이 실행한다.

staged 없음. unstaged는 `package.json`, `scripts/production-deploy-gate.test.mjs`, `server/_core/appVersion.ts`. untracked는 prepare script/test, provenance test, 이 문서다. `node_modules/`, `dist/`는 설치·빌드 임시 산출물이며 후보에 넣지 않는다. 증거는 별도 디렉터리이고 이전 증거는 덮어쓰지 않았다.

검수자는 manifest·BASE·full patch·원본 bytes를 함께 대조한 후 현재 테스트를 재실행한다. 새 작업 공간으로 옮길 때 Git EOL 설정 때문에 bytes가 달라지면 `candidate-files/`의 의도된 7파일로 복원하고 hash를 확인한다. fixture/기대값은 제품 parser로 생성하지 않았다. 고정 이후 제품·테스트·문서를 더 수정하지 않는다. 수정하면 식별값과 증거를 다시 생성해야 한다.

API field shape·DB/schema/migration·RBAC·F01/F02/F03/RF02/P2-01/P2-02는 이번에 수정하지 않았다. build linkage·stamp helper·runtime mismatch guard도 이전 후보와 동일하다. 브라우저 E2E/실기기/실제 DB/후보 GitHub CI/운영 배포는 이번에 미실행이다. UI 변경이 없으며 runtime HTTP는 격리된 loopback 검증으로 한정한다.

남은 검수 초점은 AST 선언 판별, ambiguity/parse error, native 우선 경로, byte preservation, 기존 runtime guard 보존이다. 실제 배포 가능 판정은 포함하지 않는다. 복귀는 원본 main과 이전 후보가 그대로이므로 별도 조치가 필요 없다. 후보 철회가 필요하면 동시 사용자 변경을 확인한 후 RI-only 변경만 별도 작업으로 철회한다. reset/clean/stash는 하지 않았다.

commit/push/PR/merge/deploy, Railway 설정 변경, P2-03 수행 없음.

## 2026-09-10 이전 후보 기록 — 현재 후보 PASS 근거 아님

아래는 수정 전 인계 내용이다. 당시 I05 검사는 주석·템플릿·중복 선언을 포함하지 않아 RI-01을 놓쳤다. 현재 판정은 위 2026-09-13 재실행 결과와 새 manifest를 따른다.

## 기준과 범위

- 작업일: 2026-09-10, Asia/Seoul.
- 저장소: `raonisi/boa`.
- 작업 경로: `C:/work/boa-native-release-identity`.
- 작업 브랜치: `codex/railway-native-release-identity`.
- BASE_SHA = HEAD = `675969747b8e045ef46e5a3c8fd3e655030ebe2d`.
- P2-01 #166의 `60ea31217c8901b8f5fcb9aacee3a5fb9fbe8f83`가 기준의 조상이고 P2-02 #167이 기준 커밋이다.
- 원본 `C:/work/boa-main`의 branch/HEAD/working files는 보존했다. `git fetch origin main`으로 원격 ref를 갱신하고 새 worktree/branch를 만들었다. commit/push/PR/merge는 하지 않았다.
- 작업 유형: release identity의 제한 구현. 제품 3개, 테스트 2개, 인계 문서 1개 파일이다.

## 원인과 변경 파일

기존 production metadata는 generated `RELEASE_SHA`만 신뢰하지만 native build는 이를 준비하지 않았다. 유효한 stamp가 있더라도 Railway runtime SHA와 비교하지 않아 오래된 artifact를 정상으로 인정했다. 수정 전 동일한 7자리 접두사의 다른 전체 SHA를 넣은 새 HTTP 회귀 테스트에서 기대 503 대신 실제 200을 재현했다.

| 구분 | 파일 | 변경 이유 |
|---|---|---|
| 제품·신규 | `scripts/prepare-release-identity.mjs` | native SHA 검증·stamp·verify, 기존 pre-stamp 보존, local no-op, Railway identity 누락 시 build 차단 |
| 제품·수정 | `package.json` | 실제 build 명령 맨 앞에서 준비 스크립트를 명시적으로 실행. vite/esbuild 옵션·순서 유지 |
| 제품·수정 | `server/_core/appVersion.ts` | production stamp와 유효한 Railway runtime SHA의 전체 40자리 비교. 불일치 시 null로 기존 health 503 경로 사용 |
| 테스트·수정 | `scripts/production-deploy-gate.test.mjs` | 기존 CI가 실행하는 Node 테스트에 준비 스크립트·CLI·파일 보존 회귀 7개 추가. 기존 assertion 유지 |
| 테스트·신규 | `server/_core/appVersion.provenance.test.ts` | 합성 stamp와 loopback HTTP로 provenance·API shape·fallback·민감 문자열 비노출 6개 검증 |
| 문서·신규 | 이 문서 | 정의, 검증, 후보 식별과 미검증 인계 |

기존 stamp 스크립트, `appVersionRoutes.ts`, generated 파일, direct deploy workflow, lockfile은 수정하지 않았다.

## Build-time 규칙

| 입력 | 결과 |
|---|---|
| `RAILWAY_GIT_COMMIT_SHA`가 유효한 lowercase full SHA | 기존 `validateReleaseSha`, `stampReleaseIdentity`, `verifyReleaseIdentity` 재사용, `source=railway-git` |
| SHA 값이 존재하지만 비어 있거나 잘못됨 | `INVALID_RELEASE_SHA`, exit 1. pre-stamp로 우회하지 않음. 값 원문 비노출 |
| native SHA 없음 + 유효한 기존 generated SHA | `source=pre-stamped`, 주석·CRLF를 포함해 파일 bytes 보존 |
| 둘 다 없음 + 로컬/일반 CI | `source=development-noop`, 파일 변경 없이 build 허용 |
| 둘 다 없음 + Railway system marker 존재 | `RAILWAY_RELEASE_IDENTITY_MISSING`, exit 1 |

Railway build 식별은 `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID`, `RAILWAY_ENVIRONMENT_ID` 중 비어 있지 않은 값의 존재로 한다. [Railway 공식 변수 문서](https://docs.railway.com/variables/reference)는 이 system 변수들을 모든 build/deployment에 제공하고 GitHub trigger에는 Git SHA를 제공한다고 명시한다(2026-09-10 확인). 새 사용자 환경변수나 runtime env fallback을 신뢰 근거로 추가하지 않았다. Railway 빌드에서는 환경 이름과 무관하게 보수적으로 identity 누락을 차단한다.

유효한 기존 pre-stamp는 generated 파일의 기존 typed export 문장에서 읽고 검증한다. 파일을 JavaScript로 실행해 읽지 않는다. local 테스트는 `--output` 또는 함수의 `outputPath`로 임시 파일을 사용한다. 출력은 성공 source 또는 고정 오류 코드만 포함한다.

## Runtime provenance / API

| production 입력 | identity / health |
|---|---|
| stamp 없음 + Railway SHA만 존재 | null / 503 · fallback 금지 유지 |
| valid stamp + Railway SHA 없음 | stamp / 200 · direct upload 호환 |
| valid stamp + 같은 valid Railway SHA | stamp / 200 |
| valid stamp + 다른 valid Railway SHA | null / 503 · 동일한 short prefix도 차단 |
| valid stamp + invalid Railway 문자열 | 명세의 valid-SHA 비교 조건에 따라 stamp 사용. invalid 문자열은 공개하지 않음 |

non-production의 기존 stamp 우선 및 env fallback 순서는 유지한다. `/api/version`의 기존 HTTP200와 field shape도 유지한다. `/api/health`의 기존 production identity 누락 503 분기를 재사용하며 새 응답 필드나 환경값을 공개하지 않는다. runtime env는 production identity의 단독 출처가 될 수 없다.

## I01–I12 자체 검증

| ID | 판정 | 실제 근거 |
|---|---|---|
| I01 | PASS | local temp development 파일 no-op + 실제 `pnpm.cmd build`의 development-noop |
| I02 | PASS | development/이전 SHA를 정확한 새 SHA로 stamp·verify, native esbuild artifact/HTTP |
| I03 | PASS | empty·39자리·uppercase·개행·합성 민감 문자열 거부; valid pre-stamp 불변; CLI exit1·고정 코드 |
| I04 | PASS | valid pre-stamp 보존; 실제 stamp 함수 출력과 별도 주석/CRLF 파일 byte 비교 |
| I05 | PASS | 세 Railway system marker 각각 identity 누락 거부; CLI exit1·원문 비노출 |
| I06 | PASS | runtime SHA 없는 direct stamp metadata·HTTP200 |
| I07 | PASS | matching native stamp/runtime metadata·HTTP200 |
| I08 | PASS | 수정 전 200 실패 재현 → 수정 후 null/503. full SHA는 다르지만 short prefix가 같은 사례 |
| I09 | PASS | env SHA만 있는 production null/503; 실제 unstamped bundle에서도 동일 |
| I10 | PASS | non-production env fallback·APP 우선순위·stamp 우선순위 유지 |
| I11 | PASS | 기존 stamp 함수 → preparation → 기존 verify 함수 통과. direct workflow 파일 hash 불변 |
| I12 | PASS | temp output 격리 + 실제 전체 테스트/빌드 전후 tracked generated hash 불변 |

현재 소스의 metadata/routes만 esbuild로 실제 bundle한 추가 합성 증거도 있다. native/direct/local 3가지 artifact 각각 runtime SHA 없음·일치·같은 prefix의 불일치 3조건, 총 **9/9** loopback HTTP 검증을 통과했다. 실제 Railway 빌드·운영 서버·DB 검증으로 표현하지 않는다.

## 실제 명령과 결과

기본 런타임은 Node `v24.15.0`, pnpm `10.4.1`이다. 새 worktree에 실제 `.env` 파일이 없음을 확인했다. 실행기는 OS 경로 환경값만 허용하고 DB/인증/외부 서비스 설정은 전달하지 않았다. `DATABASE_URL`은 비어 있으며 HTTP 검증 서버는 loopback에만 바인딩했다.

| 명령 | exit / 결과 | 증거 파일 |
|---|---|---|
| `pnpm.cmd test server/_core/appVersion.provenance.test.ts` · 수정 전 | 1 · 5 PASS, I08 1 FAIL(200 ≠ 503) | `pre-runtime.log` |
| `pnpm.cmd test server/_core/appVersion.test.ts server/_core/appVersion.provenance.test.ts` | 0 · 11 PASS / 0 FAIL / 0 skip | `post-runtime.log` |
| `node --test scripts/production-deploy-gate.test.mjs` · 최종 | 0 · 85 PASS / 0 FAIL / 0 skip | `final-release-node.log` |
| `pnpm.cmd check` · 최종 | 0 · PASS | `final-check.log` |
| `pnpm.cmd test` · 최종 | 0 · 113 files, 1,165 PASS / 0 FAIL / 0 skip | `final-test.log` |
| `pnpm.cmd build` · 최종 | 0 · PASS, preparation development-noop | `final-build.log` |
| `node .../artifact-proof.cjs .../artifact-run-3` | 0 · 9/9 bundle/HTTP 조합 PASS | `artifact-candidate.log`, `artifact-run-3/artifact-proof.json` |

기존 Node 78개 배포 검증에 7개를 추가했고, Vitest에는 6개를 추가했다. 기존 workflow가 Node 테스트 파일을 실행하므로 새 CI workflow나 script 변경은 필요하지 않았다. 전체 check/test/build는 최종 pre-stamp 주석·CRLF 보존 보완 후 재실행했다.

준비 과정의 오류도 보존했다. offline 설치는 캐시 누락으로 exit1, `pnpm.cmd install --frozen-lockfile --ignore-scripts` 온라인 재시도는 exit0이었다. lockfile/의존성 정의는 그대로다. 첫 보조 artifact 실행은 증거 JSON 이름 충돌로 실행기 exit1이었고 별도 출력 디렉터리에서 재실행해 exit0을 확인했다. 초기 `node -e` 읽기 명령의 Windows 인용 오류는 파일형 `hygiene.cjs`로 대체했다. 이는 제품 테스트 실패와 구분한다.

빌드에는 900KB chunk 경고가 남아 있다. 크기 정책·baseline을 수정하지 않았다. 이번에 브라우저 E2E는 실행하지 않았다. UI/라우팅 등록 변경은 없고 변경된 health 동작은 실제 loopback HTTP로 검증했다. DB/RBAC 통합과 운영 UI·실기기 검증을 새로 통과했다고 주장하지 않는다.

## 후보 식별과 검수 절차

증거 루트: `C:/work/boa-native-release-identity-evidence-20260910`.

- `candidate.patch`: BASE_SHA 대비 tracked 수정 및 untracked 신규 파일 3개를 모두 포함한다.
- `candidate-manifest.json`: branch, BASE_SHA/HEAD, staged/unstaged/untracked, 모든 후보 파일 bytes/SHA-256, patch SHA-256, candidate ID.
- `final.json`: 패치와 manifest 식별값 및 최종 검증 요약.
- `evidence-manifest.json`: 로그·합성 artifact·보조 재현 도구의 내용 hash.
- `hygiene-before.json` 및 최종 manifest: generated 파일·lockfile·workflow 내용 보존 확인.

실제 index에는 staged 파일이 없다. tracked 수정은 제품 2개와 기존 테스트 1개, untracked 신규는 준비 스크립트·runtime 테스트·이 문서다. ignored `node_modules/`, `dist/`는 로컬 설치/빌드 산출물이며 patch 대상이 아니다. 실제 고객정보·비밀파일을 후보에 포함하지 않는다.

검수자는 BASE_SHA와 manifest의 전체 파일 hash를 함께 비교해야 한다. HEAD만으로 미커밋 변경을 식별할 수 없다. 같은 후보 확인 후 위 명령을 안전한 환경에서 실행하고, 특히 malformed native SHA 거부, canonical direct stamp와 CRLF pre-stamp 보존, 동일 short prefix mismatch 503을 확인한다. 파일이 바뀌면 patch/manifest/검증 증거를 다시 고정해야 한다.

## 영향·제한·복귀

P2-01/P2-02·F01/F02/F03/RF02·DB schema/migration·Auth/RBAC 코드는 변경하지 않았다. API field shape는 유지한다. Railway Variables/Build/Pre-Deploy/Start/Skipped Builds/Autodeploy/Wait for CI 및 `PRODUCTION_DEPLOY_ENABLED`는 조회·변경하지 않았다. commit/push/PR/merge/deploy/P2-03 실행은 없다.

다음 검수 범위는 준비 스크립트의 입력 정책, production provenance, direct deploy 호환, 파일 hygiene다. 실제 Railway의 build cache/Skipped Builds 및 runtime 변수 공급은 후속 승인된 배포 검수에서 확인해야 한다. 운영 배포 가능 판정은 이번 자체 PASS에 포함하지 않는다.

현재는 미커밋 별도 worktree이므로 원본 main으로 복귀 작업이 필요하지 않다. 후보 폐기가 필요하면 독립 검수·다른 사용자 수정 유무를 다시 확인한 후 이 후보의 명시된 파일만 철회한다. 자동 reset/clean/rollback은 하지 않는다.
