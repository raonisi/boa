# 계약 건수 실적 기준 검토

파일럿 전 [TEST] 검수에서 `계약상태=유지` 계약은 월납보험료 합계에는 반영되지만, 일부 계약 건수 지표에는 기대와 다르게 보일 수 있음을 확인했습니다.
이 문서는 즉시 정책을 변경하지 않고, 현재 기준과 선택지를 정리합니다.

## 현재 확인된 기준

- `performance.stats`의 `contracted`는 고객 상담상태가 `계약`인 고객 수를 기준으로 계산합니다.
- `performance.stats`의 `activeContracts`는 계약 테이블의 `contractStatus=유지` 계약 수를 기준으로 계산합니다.
- `monthlyPremiumSum`은 `contractStatus=유지` 계약의 월납보험료 합계입니다.
- `performanceGoals.dashboard`의 목표 대비 계약 건수는 `activeContracts`를 사용합니다.
- `dashboard.todayWork`, `workRhythm.summary`는 기간 내 active 계약 목록 길이를 쓰는 경로가 있어 화면별 의미가 다를 수 있습니다.

따라서 현재 UI에서 `계약건수`, `유지계약`, `목표 계약 건수`, `이번 달 계약`이라는 문구가 서로 다른 기준을 가리킬 수 있습니다.

## A안. 계약상태=계약 계열만 count

정의:
- 고객 상담상태 또는 별도 계약 전환 상태가 `계약`인 경우만 계약 건수로 봅니다.

장점:
- 기존 `contracted` 의미와 가장 가깝습니다.
- 전환율 지표와 연결하기 쉽습니다.

주의:
- 계약 테이블의 `contractStatus=유지`와 혼동됩니다.
- 실제 유효 계약 수와 다르게 보일 수 있습니다.

영향 범위:
- `server/db.ts`의 `getPerformanceStats`
- `client/src/pages/Performance.tsx`
- `client/src/pages/Dashboard.tsx`
- 전환율/계약률 테스트

## B안. 유지 상태도 count 포함

정의:
- active 계약 중 `contractStatus=유지`도 계약 건수에 포함합니다.

장점:
- 월납보험료 합계 기준과 사용자가 기대하는 유효 계약 수가 일치합니다.
- 지점장 `내 계약/내 실적` 검수에서 직관적입니다.

주의:
- 기존 `contracted`가 상담상태 기반 전환 고객 수였던 경우 의미가 바뀝니다.
- 계약률 계산식이 변경될 수 있습니다.

영향 범위:
- `server/db.ts`의 `getPerformanceStats`
- `server/routers.ts`의 `dashboard.todayWork`, `workRhythm.summary`, `performanceGoals.dashboard`
- `client/src/pages/Performance.tsx`
- `client/src/pages/Dashboard.tsx`
- `client/src/pages/PerformanceGoals.tsx`
- 실적/목표/대시보드 테스트

## C안. 신규 계약 건수 / 유지 계약 건수 / 전체 유효 계약 건수 분리

정의:
- 신규 계약 건수: 해당 기간 contractDate 기준으로 생성된 active 계약 수
- 유지 계약 건수: 현재 `contractStatus=유지`인 active 계약 수
- 전체 유효 계약 건수: soft deleted/inactive가 아닌 계약 수
- 고객 전환 수: 고객 상담상태가 `계약`인 고객 수

장점:
- 전환 지표와 유효 계약 지표를 분리해 혼선을 줄입니다.
- 목표관리와 실적관리에서 어떤 숫자를 보는지 명확해집니다.
- 기존 로직을 바로 덮어쓰지 않고 점진적으로 UI 문구를 정리할 수 있습니다.

주의:
- API 응답과 UI 문구를 추가해야 하므로 별도 PR로 분리하는 것이 안전합니다.
- 기존 테스트 기대값을 용어별로 재정리해야 합니다.

영향 범위:
- `server/db.ts`
  - `getPerformanceStats` 응답에 `newContractCount`, `activeContractCount`, `validContractCount`, `convertedCustomerCount` 같은 명확한 필드 추가
- `server/routers.ts`
  - `performanceGoals.dashboard`
  - `dashboard.todayWork`
  - `workRhythm.summary`
- `client/src/pages/Performance.tsx`
  - 카드 라벨 분리
- `client/src/pages/Dashboard.tsx`
  - `계약건수`와 `유지계약` 라벨 정리
- `client/src/pages/PerformanceGoals.tsx`
  - 목표 기준을 신규 계약 또는 유효 계약 중 어떤 것으로 볼지 선택/표시
- 테스트
  - soft deleted 계약 제외
  - `유지` 계약 월납보험료 포함
  - 신규/유지/유효 계약 건수 분리
  - 목표 달성률 기준 명시

## 추천안

추천은 C안입니다.

파일럿 전 즉시 실적 숫자를 바꾸기보다, 별도 PR에서 계약 건수 지표를 `신규 계약`, `유지 계약`, `전체 유효 계약`, `고객 전환`으로 분리하는 것이 안전합니다.
이렇게 하면 기존 지표를 갑자기 깨지 않으면서도 지점장 본인 계약/실적과 목표관리 숫자의 의미를 명확히 할 수 있습니다.

## 이번 보완 PR에서 하지 않는 일

- 실적 계산 정책 변경
- 기존 계약 상태 enum 변경
- 계약 데이터 수정
- 목표 달성률 기준 변경

위 변경은 별도 PR에서 진행합니다.
