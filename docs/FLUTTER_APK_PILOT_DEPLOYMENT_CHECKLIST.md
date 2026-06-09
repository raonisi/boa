# BOA CRM Flutter APK Pilot Deployment Checklist

BOA CRM **Flutter field app** (`apps/boa`)를 **제한 파일럿** 대상자에게 APK로 배포하기 전, 빌드·설치·권한·푸시·로그인·회귀·보안 파일을 점검하는 운영자용 체크리스트입니다.

**Related docs**

- [MOBILE_APP_ARCHITECTURE.md](./MOBILE_APP_ARCHITECTURE.md) — 앱 역할·Native vs WebView 경계
- [FLUTTER_NATIVE_FIELD_COVERAGE.md](./FLUTTER_NATIVE_FIELD_COVERAGE.md) — Native 80% 기능 매트릭스
- [PILOT_READINESS_RECHECKLIST.md](./PILOT_READINESS_RECHECKLIST.md) — 서버·RBAC·웹 파일럿 검수 게이트
- [FLUTTER_ANDROID_APP.md](./FLUTTER_ANDROID_APP.md) — Flutter Android 로컬 설정

**Result legend**

- `[ ]` 미확인
- `[x]` PASS
- `[!]` 후속 필요
- `[BLOCKED]` 파일럿 중단

---

## A. 배포 목적

| 항목 | 정책 |
| --- | --- |
| 공식 파일럿 앱 | **Flutter** (`apps/boa`) — 현장 설계사용 실행 앱 |
| 일상 업무 | **약 80% Flutter Native** (고객·후속·일정·계약·알림 등) |
| 관리자·고위험·대량 | **WebView 또는 PC Web** 유지 (일괄등록, DB배정, 병합, 삭제, 인수인계, 감사로그 등) |
| 이번 배포 성격 | **공개 정식 출시 아님** — 내부·제한 파일럿 (3~5명 권장) |
| Legacy | Capacitor (`android/app`, `capacitor.config.ts`) **삭제하지 않음** — Flutter 안정화 전 fallback |

---

## B. 배포 전 Git 상태 확인

배포 담당자는 APK 빌드 직전 아래를 실행하고 결과를 기록합니다.

```powershell
git status --short
git branch --show-current
git log --oneline --decorate -5
```

| 확인 항목 | 기준 |
| --- | --- |
| 저장소 | `https://github.com/raonisi/boa` (origin) |
| 배포 브랜치 | `main` 또는 승인된 release/파일럿 브랜치가 **명확** |
| Working tree | **clean** (의도하지 않은 수정 없음) |
| 배포 commit | **short hash + full hash** 기록 (예: `8804f84`) |
| Stage 금지 | `.env`, `google-services.json`, Firebase Admin JSON, APK/AAB, JKS/keystore, `local.properties`, Android generated dirty, 실제 고객 데이터 |
| Stage 방식 | `git add .` **사용 금지** — 관련 파일만 명시적으로 stage |

**기록 템플릿**

```text
배포일:
배포 브랜치:
Commit (short / full):
빌드 담당:
```

---

## C. 루트 검증 명령

APK 배포 전 **반드시** 실행합니다. 하나라도 실패하면 **APK 배포 중단**.

```powershell
cd C:\work\boa-main
pnpm.cmd check
pnpm.cmd test
pnpm.cmd build
```

| 명령 | PASS 기준 |
| --- | --- |
| `pnpm.cmd check` | TypeScript `tsc --noEmit` 오류 없음 |
| `pnpm.cmd test` | Vitest 전체 PASS |
| `pnpm.cmd build` | Vite + server bundle 빌드 성공 |

---

## D. Flutter 검증 명령

```powershell
cd apps\boa
flutter --version
flutter pub get
flutter analyze
flutter test
```

| 명령 | PASS 기준 |
| --- | --- |
| `flutter pub get` | 의존성 해석 성공 |
| `flutter analyze` | **error 0건** (warning은 아래 분류) |
| `flutter test` | 가능하면 전체 PASS |

**Analyze warning 분류 (배포 판단용)**

| 등급 | 예시 | APK 배포 |
| --- | --- | --- |
| P0 | analyze error, 빌드 실패 | **중단** |
| P1 | 인증·API·navigation 관련 warning | 수정 후 배포 |
| P2 | deprecated API, non-critical lint | 기록 후 조건부 배포 |
| P3 | `prefer_const` 등 스타일 | 기록만, 배포 가능 |

**Windows `flutter test` isolate 실패 시**

- 증상: `Could not prepare isolate` / `Could not create root isolate`
- 조치: 사유·환경(Windows 버전, Flutter channel)을 배포 기록에 남기고, **실기기 smoke test**로 보완
- analyze + 실기기 smoke PASS이면 조건부 파일럿 진행 가능 (담당자 승인)

**Release 빌드 `dart-define` (운영 파일럿)**

| 이름 | 설명 |
| --- | --- |
| `BOA_API_BASE_URL` | 프로덕션 API 루트 (예: `https://raonisis.kr`) — **값을 문서/채팅에 secret과 함께 붙여넣지 않음** |
| `BOA_GOOGLE_SERVER_CLIENT_ID` | Google 웹 OAuth 클라이언트 ID — 서버 `GOOGLE_CLIENT_ID`와 일치 |

로컬 예시는 [FLUTTER_ANDROID_APP.md](./FLUTTER_ANDROID_APP.md) 참고.

---

## E. APK 빌드 기준

> **이 체크리스트 PR은 APK를 생성·커밋하지 않습니다.** 아래는 **운영자 실행 기준**만 정의합니다.

### E.1 사전 조건

- [ ] `apps/boa/android/app/google-services.json` — **로컬만** 존재, git 미포함
- [ ] Release keystore — **로컬/CI secret** 보관, git 미포함
- [ ] `local.properties` — git 미포함
- [ ] `flutter doctor` Android toolchain OK

### E.2 빌드 명령 (예시)

**내부 파일럿 — release APK (권장)**

```powershell
cd apps\boa
flutter pub get
flutter build apk --release `
  --dart-define=BOA_API_BASE_URL=<PRODUCTION_API_BASE> `
  --dart-define=BOA_GOOGLE_SERVER_CLIENT_ID=<GOOGLE_WEB_CLIENT_ID>
```

**개발·점검용 (필요 시만)**

```powershell
flutter build apk --debug
# 또는
flutter build apk --profile
```

| 정책 | 내용 |
| --- | --- |
| Git stage | `build/app/outputs/` 하위 **APK/AAB 절대 stage 금지** |
| 파일명 권장 | `boa-pilot-YYYYMMDD-<commit-short>.apk` |
| 보관 | 사내 안전 경로(암호화 드라이브·CI artifact) — 공개 링크 금지 |
| 공유 | 카카오/이메일/공개 드라이브 **최소 인원** — 파일럿 대상자만 |
| 문서 | keystore password, API secret, Firebase private key **문서에 기록 금지** |

### E.3 산출물 확인 (로컬, git 제외)

- [ ] APK 설치 가능 (Android 8+ 권장, 실제 대상 기기 버전 기록)
- [ ] 패키지명: `kr.raonisis.boa`
- [ ] 앱 표시명: `BOA CRM` (AndroidManifest `android:label`)
- [ ] 아이콘·스plash 정상

---

## F. Android 설치 전·후 확인

| # | 항목 | 기대 결과 | PASS/FAIL | 비고 |
| --- | --- | --- | --- | --- |
| F1 | APK 설치 | 알 수 없는 출처 허용 후 설치 성공 | | |
| F2 | 앱명 | `BOA CRM` | | |
| F3 | 패키지명 | `kr.raonisis.boa` | | |
| F4 | 아이콘 | BOA 아이콘 표시 | | |
| F5 | 첫 실행 | crash 없이 스플래시 → 로그인/홈 | | |
| F6 | 권한 요청 | 알림 등 권한 문구 이해 가능 | | |
| F7 | 알림 권한 | Android 13+ POST_NOTIFICATIONS 흐름 정상 | | |
| F8 | 백그라운드 복귀 | 세션 유지, 재로그인 불필요 | | |
| F9 | 로그아웃 → 재로그인 | 정상 | | |

---

## G. 로그인 / 인증 Smoke Test

| # | 항목 | 테스트 시나리오 | 기대 결과 | PASS/FAIL | 비고 |
| --- | --- | --- | --- | --- | --- |
| G1 | Google OAuth | Google 계정으로 로그인 | 홈/셸 진입 | | |
| G2 | 허용 사용자 | CRM 등록 active 사용자 | 로그인 성공 | | |
| G3 | inactive/resigned | 비활성·퇴사 계정 | 로그인 차단·안내 | | |
| G4 | branch_admin | 관리자 계정 | Drawer 관리자 WebView 메뉴 노출 | | |
| G5 | sub_branch_admin | 지점장 | scope 내 메뉴·데이터 | | |
| G6 | team_leader | 팀장 | scope 내 메뉴·데이터 | | |
| G7 | member | 설계사 | Native 현장 기능 중심 | | |
| G8 | Token UI | 전 화면 | JWT·device token **원문 미표시** | | |
| G9 | 로그아웃 | Drawer 로그아웃 | 세션 제거·로그인 화면 | | |
| G10 | 세션 만료 | 만료/401 상황 | 재로그인 안내 (WebView/Native) | | |

---

## H. Flutter Native 기능 Smoke Test

테스트 데이터: **`[TEST] 파일럿 검수 고객`** 및 `[TEST]` prefix 데이터만 사용. **실제 고객 데이터 사용 금지.**

| # | 기능 | 테스트 시나리오 | 기대 결과 | PASS/FAIL | 비고 |
| --- | --- | --- | --- | --- | --- |
| H1 | Dashboard / Field Command Center | 홈 탭 진입, pull-to-refresh | 오늘 할 일·알림 요약 표시 | | |
| H2 | CustomerList | 고객 탭, 목록 스크롤 | scope 내 고객만, empty/loading 정상 | | |
| H3 | Global Search | Shell 검색 진입, `[TEST]` 검색 | 결과 탭 → 고객 상세 | | |
| H4 | CustomerDetail 360 | `[TEST]` 고객 상세 | 타임라인·후속·일정·계약 패널 | | |
| H5 | ConsultationRecord | 빠른 실행 → 상담 (Web fallback) | WebView 또는 안내 정상 | | |
| H6 | Follow-up Quick Action | Field Command 또는 상세에서 완료/연기 | API 성공·목록 갱신 | | |
| H7 | Schedule / Calendar Quick Action | 일정 탭, 오늘 일정 완료 | 상태 갱신 | | |
| H8 | ContractList | 계약 탭 | 목록·월납 요약 | | |
| H9 | ContractCreate | 신규 계약 등록 (`[TEST]` 고객) | validation·저장·목록 반영 | | |
| H10 | Notifications | 알림 탭, 미확인 필터 | 유형·상태 badge, mark read | | |
| H11 | PushPreferences | 알림 설정, 저장 | toggle·quiet hours 저장 성공 | | |
| H12 | Performance / Goals | Drawer Native 메뉴 | 실적·목표 화면 로드 | | |

---

## I. WebView Fallback Smoke Test

**고위험 실행 금지:** 병합·삭제·permanent delete·인수인계 **실제 실행하지 않음** — 진입·로딩·안내·권한만 확인.

| # | 화면 | 테스트 시나리오 | 기대 결과 | PASS/FAIL | 비고 |
| --- | --- | --- | --- | --- | --- |
| I1 | 고객 일괄 등록 | Drawer → 일괄 등록 | WebView 진입, PC 권장 배너 | | 실행 금지 |
| I2 | DB 배정 | Drawer → DB 배정 | 로딩·뒤로가기 정상 | | 실행 금지 |
| I3 | 사용자 관리 | branch_admin | 진입·권한 안내 | | |
| I4 | 조직 관리 | manager/admin | 진입·PC 권장 | | |
| I5 | 인수인계 | branch_admin | 고위험 안내 표시 | | **실행 금지** |
| I6 | 중복 고객 병합 | branch_admin | 고위험 안내 | | **실행 금지** |
| I7 | 삭제 데이터 관리 | branch_admin | PC 권장·고위험 안내 | | **실행 금지** |
| I8 | ActivityLog / 활동 로그 | manager | WebView 로드 | | |
| I9 | OperationRisk | branch_admin | `/operation-risk` 진입 | | |
| I10 | Push Operations | branch_admin | 발송 로그 WebView | | token 미노출 |
| I11 | 세일즈 파이프라인 | member+ | 칸반 WebView | | |
| I12 | 영업 분석 | manager | 차트 WebView, PC 권장 | | |

공통 확인:

- [ ] WebView loading 카드 표시
- [ ] AppBar 뒤로가기 → history back / pop
- [ ] 권한 없음 → forbidden 안내 (서버 RBAC)
- [ ] URL·JWT·token **오류 화면에 미노출**

---

## J. Push / Notification Smoke Test

| # | 항목 | 테스트 시나리오 | 기대 결과 | PASS/FAIL | 비고 |
| --- | --- | --- | --- | --- | --- |
| J1 | Device token 등록 | 로그인 후 FCM | 서버 `user_device_tokens` 등록 (UI에 token 없음) | | |
| J2 | Token UI | 설정·로그·알림 화면 | device token **원문 미표시** | | |
| J3 | PushPreferences 저장 | toggle 변경 후 저장 | 성공 snackbar | | |
| J4 | 전체 ON/OFF | 업무 푸시 전체 | 하위 toggle 연동 | | |
| J5 | 조용한 시간대 | 시작/종료 시간 UI | overflow 없음, 저장 | | |
| J6 | 알림함 | 미확인 알림 | 유형·상태 표시 | | |
| J7 | unread/read | mark read | 상태 갱신 | | |
| J8 | Push payload | 테스트 알림 수신 | title/body **민감정보 없음** | | |

### Push payload 금지 항목 (잠금화면·알림함·로그 공통)

다음이 push title/body·앱 UI에 **포함되면 배포 중단**:

- 고객명, 전화번호, 생년월일, 질병명, 보험상품명, 보험료, 계약 상세
- device token, credential, secret, Firebase 정보
- OAuth/JWT/session 정보, DB URL

허용 예: “오늘 확인할 업무가 있습니다.”, “예정된 일정이 있습니다.”, “후속관리할 항목이 있습니다.”

정책 참고: [PUSH_NOTIFICATION_OPERATION_POLICY.md](./PUSH_NOTIFICATION_OPERATION_POLICY.md)

---

## K. 파일럿 대상자 기준

### K.1 권장 구성 (총 3~5명)

| 역할 | 인원 | 목적 |
| --- | --- | --- |
| 내부 관리자 | 1 | RBAC·WebView·배포 이슈 1차 수집 |
| 지점장 또는 팀장 | 1 | scope·관리자 메뉴 smoke |
| 현장 설계사 (member) | 1~3 | Native 일상 업무 실사용 |

### K.2 테스트 데이터

- [ ] **실제 고객 데이터 사용 금지**
- [ ] 테스트 고객명: **`[TEST] 파일럿 검수 고객`**
- [ ] 계약·일정·후속·상담도 `[TEST]` prefix로 식별
- [ ] 파일럿 중 production hard delete / reset / drop / truncate **미실행**

### K.3 대상자 설치 안내 (배포 전 확인)

- [ ] APK 수신 경로·버전(commit hash) 안내
- [ ] 알 수 없는 출처 설치 방법 (내부 문서)
- [ ] 이슈 보고 채널 (표 M 참고)
- [ ] PC Web 병행 안내 (대량·고위험 작업)

---

## L. 파일럿 중 이슈 수집 기준

발견 즉시 아래 표에 기록합니다.

| 발생일 | 사용자 role | 기기명 | Android 버전 | 화면 | 재현 단계 | 기대 결과 | 실제 결과 | 심각도 | 스크린샷 | 담당 PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | P0/P1/P2/P3 | Y/N | |

### 심각도 정의

| 등급 | 기준 | 조치 |
| --- | --- | --- |
| **P0** | 로그인 불가, 앱 crash, 고객정보 노출, 권한 우회, token/secret 노출 | **즉시 배포 중단** |
| **P1** | 핵심 업무 불가, 후속/일정/계약 저장 실패, push 설정 불가 | 배포 중단·핫픽스 |
| **P2** | 특정 화면 UX, 알림/상태 갱신 지연 | 다음 fix pack |
| **P3** | 문구·여백·색상 polish | 백로그 |

---

## M. 배포 중단 기준

아래 **하나라도** 해당 시 APK 배포·파일럿 **즉시 중단**:

- [ ] 로그인 불가 (Google OAuth / 세션)
- [ ] 앱 실행 crash (cold start)
- [ ] 고객 scope 우회 (타 담당 고객 조회·수정)
- [ ] 민감정보 UI 노출 (전화번호·질병명·보험료 등)
- [ ] token / secret / device token UI·로그·push 노출
- [ ] push payload에 민감정보 포함
- [ ] 계약·후속·일정 저장 데이터 오류 (잘못된 scope 저장)
- [ ] WebView 고위험 화면에서 의도치 않은 삭제·병합·인수인계 실행 가능
- [ ] APK·저장소에 secret 파일 포함 (`.env`, keystore, `google-services.json` 커밋 등)
- [ ] `pnpm check` / `pnpm test` / `pnpm build` 또는 `flutter analyze` error

---

## N. 배포 후 3~7일 운영 기준

| 일차 | 초점 | 확인 항목 |
| --- | --- | --- |
| **1일차** | 설치·로그인·기본 smoke | F, G, H1~H3 |
| **2~3일차** | 현장 실사용 | H4~H9 (`[TEST]` 데이터), 후속·일정·계약 |
| **4~5일차** | 알림·WebView | J 전체, I (진입만, 고위험 실행 금지) |
| **6~7일차** | 회고 | 표 L 정리, P0/P1 → Pilot Feedback Fix Pack 후보 분류 |

**7일차 종료 시**

- [ ] 파일럿 GO/HOLD 결정 (담당자 서명)
- [ ] Capacitor deprecation 여부는 **별도 PR** (Flutter 안정화 후)
- [ ] 다음 배포 APK commit hash 기록

---

## Quick Reference — Operator Command Block

```powershell
# 1. Git
git status --short
git branch --show-current
git log --oneline --decorate -5

# 2. Root
cd C:\work\boa-main
pnpm.cmd check
pnpm.cmd test
pnpm.cmd build

# 3. Flutter
cd apps\boa
flutter --version
flutter pub get
flutter analyze
flutter test

# 4. APK (로컬 only — git stage 금지)
flutter build apk --release `
  --dart-define=BOA_API_BASE_URL=<PRODUCTION_API_BASE> `
  --dart-define=BOA_GOOGLE_SERVER_CLIENT_ID=<GOOGLE_WEB_CLIENT_ID>
```

---

## Sign-off

| 역할 | 이름 | 날짜 | 결과 (GO / HOLD) |
| --- | --- | --- | --- |
| Flutter 빌드 | | | |
| QA / Pilot ops | | | |
| Product / Branch owner | | | |

**Commit deployed:** `________________`  
**APK filename:** `boa-pilot-________-________.apk`
