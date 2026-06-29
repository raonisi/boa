# BOA CRM E2E 실행 가이드

Playwright 기반 E2E는 `e2e/`에 있으며, 모든 케이스는 페이지 단위 tRPC mock
(`e2e/fixtures/mock-trpc.ts`)을 사용합니다. 실제 운영 DB·고객정보·외부 네트워크를
사용하지 않습니다.

## 구성 요약

- spec 파일
  - `core-smoke.spec.ts` — 핵심 라우트/권한/다운로드/캘린더/배정 스모크
  - `role-responsive-smoke.spec.ts` — 역할·viewport·route guard·preset·MobileNav·민감정보 비노출
- 프로젝트(viewport)
  - `desktop-chromium` (1440), `desktop-1280` (1280), `mobile-chromium` (Pixel 5)
- 동시성: `fullyParallel: true`, `workers = E2E_WORKERS ?? (CI ? 2 : "50%")`
- 단일 dev server(`e2e/start-dev-server.mjs`)를 모든 worker가 공유
- 총 케이스 범위: 186 (mobile/desktop 전용 케이스는 비대상 프로젝트에서 의도적으로 skip)

## 명령어

| 명령 | 목적 |
| --- | --- |
| `pnpm.cmd test:e2e` | 전체 E2E (3 프로젝트 × 2 spec) |
| `pnpm.cmd test:e2e:smoke` | `core-smoke.spec.ts`만 — 빠른 핵심 검사 |
| `pnpm.cmd test:e2e:roles` | `role-responsive-smoke.spec.ts`만 — 역할/viewport |
| `pnpm.cmd test:e2e:desktop` | desktop 1440 + 1280 프로젝트 |
| `pnpm.cmd test:e2e:mobile` | mobile(Pixel 5) 프로젝트 |
| `pnpm.cmd test:e2e:bulk-import` | 일괄등록 관련 케이스(`--grep "bulk import"`) |
| `pnpm.cmd test:e2e:calendar` | 캘린더 관련 케이스(`--grep "calendar"`) |
| `pnpm.cmd test:e2e:customer` | 고객 관련 케이스(`--grep "customer"`) |
| `pnpm.cmd test:e2e:shard:1` … `:4` | CI 샤딩(`--shard=n/4`), 4분할 |

### CI 샤딩

`--shard=n/4`는 Playwright가 모든 프로젝트·spec의 테스트를 4등분해 배분합니다.
4개 shard를 합치면 `test:e2e` 전체 범위와 동일합니다. CI에서는 4개 job을 병렬로
실행해 단일 실행 timeout을 피합니다.

```bash
# 예: GitHub Actions matrix
pnpm.cmd test:e2e:shard:1   # job 1
pnpm.cmd test:e2e:shard:2   # job 2
pnpm.cmd test:e2e:shard:3   # job 3
pnpm.cmd test:e2e:shard:4   # job 4
```

worker 수를 직접 조정하려면 `E2E_WORKERS`를 사용합니다(예: `E2E_WORKERS=4`).

## 실행 시간 기준선

| 명령 | 결과 | 소요시간 |
| --- | --- | --- |
| `test:e2e` (직렬 구버전) | 300s timeout | >8m (실패) |
| `test:e2e` (병렬) | 149 passed / 37 skipped | ~3.2m |
| `test:e2e:smoke` | 81 passed / 9 skipped | ~1.4m |

> 과거 단일 전체 실행이 300초에서 멈춘 원인은 **기능 결함이 아니라 직렬 실행
> 구성**(`workers:1`, `fullyParallel:false`)이었습니다. 프로젝트/spec별 분할 실행은
> 모두 통과했습니다.

## timeout 발생 시 확인 순서

1. 어느 명령에서 멈췄는지 확인 (`test:e2e` 전체 vs 특정 프로젝트/spec).
2. `test:e2e:smoke`로 핵심 경로가 정상인지 먼저 확인.
3. 프로젝트별(`:desktop`, `:mobile`) 또는 shard(`:shard:1`..`:4`)로 분할 재실행.
4. 단일 케이스가 느리면 `--grep "<title>"`로 격리하고 `--trace on`으로 추적.
5. 직렬 환경(저사양 CI)이라면 shard 수를 늘리거나 `E2E_WORKERS`를 낮춰 안정화.
6. dev server 기동 실패면 포트(`E2E_PORT`, 기본 3187) 점유 여부 확인.

## 의도된 skip 목록

모든 skip은 **프로젝트(viewport) 게이팅**이며, 다른 프로젝트에서 동일 케이스가
실행됩니다. 실패를 숨기기 위한 skip은 없습니다.

- `desktop-only` 게이팅: 비desktop 프로젝트에서 skip
  (데스크톱 시각 스모크 등)
- `mobile-only` 게이팅: 비mobile 프로젝트에서 skip
  (모바일 비주얼 스모크, 모바일 고객상세 빠른액션, 모바일 운영리스크 탭,
  모바일 매니저 운영리스크, MobileNav action bar gap,
  inactive/resigned MobileNav 미노출, 모바일 알림 일괄 체크박스, member more 메뉴 등)

## 운영 배포 전 권장 조합

1. `pnpm.cmd check && pnpm.cmd test && pnpm.cmd build`
2. `pnpm.cmd test:e2e:smoke` (빠른 게이트)
3. `pnpm.cmd test:e2e` 또는 CI에서 `:shard:1`..`:4` 병렬

> Railway 배포·실제 브라우저·Android는 별도 절차이며 이 가이드 범위 밖입니다.
