# BOA CRM E2E 실행 가이드

Playwright 기반 E2E는 `e2e/`에 있으며, 모든 케이스는 페이지 단위 tRPC mock
(`e2e/fixtures/mock-trpc.ts`)을 사용합니다. 실제 운영 DB·고객정보·외부 네트워크를
사용하지 않습니다.

## 기본 port (중요)

| 항목 | 값 |
| --- | --- |
| 기본 port | **3187** (`E2E_DEFAULT_PORT`) |
| baseURL | `http://127.0.0.1:3187` (또는 `E2E_PORT`와 동일) |
| webServer | `node e2e/start-dev-server.mjs` |
| strict binding | E2E 전용 `RAILWAY_ENVIRONMENT=e2e`로 port fallback **비활성** |

dev server가 3187 대신 3188 등으로 뜨면 Playwright baseURL과 불일치해
`ECONNREFUSED` / `Failed to fetch`가 발생합니다. E2E는 **fallback 없이** 3187에
고정하거나, 충돌 시 명확히 실패합니다.

### port 충돌 시 처리

1. 다른 Playwright/ dev 프로세스가 3187을 점유 중인지 확인 후 종료.
2. `netstat -ano | findstr :3187` (Windows)로 PID 확인.
3. 재실행: `pnpm.cmd test:e2e:smoke`
4. 다른 port가 필요하면 **동일 값**으로 `E2E_PORT` 설정 (webServer·baseURL·OAuth URL 모두 자동 정렬).
5. Unix 전용 `E2E_PORT=3187 pnpm ...` 문법은 Windows에서 쓰지 않음 — PowerShell:
   `$env:E2E_PORT='3190'; pnpm.cmd test:e2e:smoke`

## 구성 요약

- spec: `core-smoke.spec.ts`, `role-responsive-smoke.spec.ts`
- 프로젝트: `desktop-chromium` (1440), `desktop-1280`, `mobile-chromium` (Pixel 5)
- 기본 config: `workers=1`, `fullyParallel=false` (안정성 우선)
- 총 케이스: 186 (비대상 프로젝트에서 viewport 게이팅 skip)

## 권장 로컬 실행 순서

```powershell
pnpm.cmd check
pnpm.cmd test
pnpm.cmd build
pnpm.cmd test:e2e:smoke
pnpm.cmd test:e2e:roles
```

배포 전 또는 회귀 확인 시: `pnpm.cmd test:e2e` 또는 shard 4분할 병렬.

## 명령어

| 명령 | 목적 | workers |
| --- | --- | ---: |
| `pnpm.cmd test:e2e:smoke` | 핵심 스모크 (`core-smoke.spec.ts`) | 1 |
| `pnpm.cmd test:e2e:roles` | 역할/viewport/route guard (`role-responsive-smoke.spec.ts`) | 1 |
| `pnpm.cmd test:e2e:desktop` | desktop 1440 + 1280 | 1 |
| `pnpm.cmd test:e2e:mobile` | mobile (Pixel 5) | 1 |
| `pnpm.cmd test:e2e:bulk-import` | 일괄등록 grep | 1 |
| `pnpm.cmd test:e2e:calendar` | 캘린더 grep | 1 |
| `pnpm.cmd test:e2e:customer` | 고객 grep | 1 |
| `pnpm.cmd test:e2e:shard:1` … `:4` | CI 4분할 shard | 1 |
| `pnpm.cmd test:e2e` | 전체 E2E (3 프로젝트 × 2 spec) | 2 |

### workers 조정

- 기본: config `workers=1`, smoke/roles/shard 스크립트는 `--workers=1` 고정.
- 전체 suite: `test:e2e`는 `--workers=2`.
- override: `$env:E2E_WORKERS='2'; pnpm.cmd test:e2e` (PowerShell).

### CI 권장

- **게이트**: `test:e2e:smoke` + `test:e2e:roles` (순차 job 또는 병렬 job, 각각 단일 worker).
- **전체 coverage**: 4개 shard job 병렬 (`test:e2e:shard:1` … `:4`, 각 `--workers=1`).
- full `test:e2e` 단일 job은 5분+ 소요 가능 — **CI 표준은 shard 4분할**.

## timeout 발생 시 확인 순서

1. port 3187 점유 / 3188 fallback 로그 여부 (`Port 3187 is busy, using port 3188`).
2. `test:e2e:smoke` 단독 재실행.
3. 프로젝트별(`:desktop`, `:mobile`) 또는 shard로 분할.
4. `--grep "<title>"` + `--trace on`으로 단일 케이스 격리.
5. full timeout이면 suite 시간 문제 — shard를 표준으로 사용.

## 의도된 skip

모든 skip은 **viewport 프로젝트 게이팅** (`desktop-only` / `mobile-only`).
다른 프로젝트에서 동일 케이스가 실행됩니다. 실패 은폐용 skip 없음.

## 실행 시간 참고

| 명령 | 대략 소요 |
| --- | --- |
| `test:e2e:smoke` | ~2–3m |
| `test:e2e:roles` | ~4–6m |
| `test:e2e` (workers=2) | ~5–8m |
| shard (각 1/4) | ~1–2m |

> Railway 배포·실제 브라우저·Android는 별도 절차입니다.
