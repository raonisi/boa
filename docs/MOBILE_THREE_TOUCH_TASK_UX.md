# 신규 로드맵 PR4. 모바일 3터치 업무 완료 UX

이 문서는 사용자가 새로 정의한 로드맵 기준의 신규 PR4를 설명한다. 기존 HANDOFF에 기록된 과거 PR4(다음 연락일 + 후속관리)와는 별도 작업이며, PR5 영업 퍼널·성과 리포트와 PR6 운영 리스크 센터는 이번 범위에 포함하지 않는다.

## 목적

모바일 대시보드에서 팀원이 고객 상세 화면까지 이동하지 않고 오늘 할 일을 빠르게 처리하도록 돕는다.

기본 흐름은 다음 3단계다.

1. 오늘 할 일 카드 선택
2. 빠른 액션 선택
3. 저장 또는 처리 확정

## 적용 범위

- 모바일 대시보드의 오늘 업무 요약
- 후속관리 완료, 연기, 취소
- 일정 완료
- 알림 확인, 처리완료
- 장기 미관리 고객의 상담상태 빠른 변경 또는 상담기록 진입

## 제외 범위

- PR5 영업 퍼널·성과 리포트
- PR6 운영 리스크 센터
- 마케팅 알림
- 푸시 알림 payload 변경
- Play Store 배포
- 운영 DB reset, drop, hard delete
- DB schema migration

## 권한과 보안

모바일 화면의 버튼 노출은 편의 기능일 뿐이며, 실제 상태 변경은 기존 서버 라우터의 권한 검증을 통과해야 한다.

- 후속관리: `followUps.complete`, `followUps.postpone`, `followUps.cancel`
- 일정: `schedules.update`
- 알림: `notifications.markRead`, `notifications.updateProcessStatus`
- 고객 상태: `customers.update`

activity log에는 기존 라우터 정책대로 고객 연락처, 민감 메모, 질병명, 상품명, 보험료, 토큰 원문을 저장하지 않는다.

## 운영자 QA 체크리스트

- 모바일 대시보드 첫 화면에서 `오늘 업무 요약`과 `3터치 빠른 처리`가 보이는지 확인한다.
- 후속관리 카드 선택 후 완료 처리 시 카드가 사라지거나 카운트가 갱신되는지 확인한다.
- 후속관리 연기에서 오늘, 내일, 3일 후, 1주 후, 직접 선택이 동작하는지 확인한다.
- 일정 카드에서 완료 처리 후 일정 카운트가 갱신되는지 확인한다.
- 알림 카드에서 확인 또는 처리완료 후 미확인 알림 수가 갱신되는지 확인한다.
- 장기 미관리 고객에서 연락완료 또는 부재 처리 시 상담상태가 갱신되는지 확인한다.
- 하단 모바일 내비게이션과 액션 시트가 겹치지 않는지 확인한다.
- member 계정에서 타인 업무 직접 처리 API가 차단되는지 확인한다.
- inactive 또는 resigned 계정으로 주요 처리 API가 차단되는지 확인한다.

## 검증 메모

- `pnpm.cmd check`: 통과
- `pnpm.cmd test`: 통과
- `pnpm.cmd build`: 통과
- `pnpm.cmd exec cap sync android`: 통과. 생성된 Android 산출물 변경은 커밋하지 않는다.
- `android/gradlew.bat assembleDebug`: JAVA_HOME 미설정 및 java PATH 없음으로 미검증. 코드 실패가 아니라 로컬 JDK 환경 문제다.
- 실제 모바일 브라우저 클릭 QA와 Android APK 실기기 클릭 QA는 아직 미수행이다. 파일럿 운영 전 운영 도메인 또는 Preview에서 별도 확인이 필요하다.
