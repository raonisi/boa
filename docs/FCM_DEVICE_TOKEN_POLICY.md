# FCM Device Token Policy

## 목적

PR19-2는 BOA 지점관리 CRM Android 내부 APK에서 Firebase Cloud Messaging registration token을 발급받아 로그인 사용자 기준으로 서버에 저장하는 단계입니다.

이번 PR은 알림 수신 준비만 담당합니다. 후속관리 알림, 일정 알림, 계약 삭제 요청 알림 발송은 PR19-3 이후 별도 작업입니다.

## Firebase 프로젝트 준비

1. Firebase Console에서 프로젝트를 생성합니다.
2. Android 앱을 추가하고 package name은 `kr.raonisis.boa`로 등록합니다.
3. Firebase Console에서 `google-services.json`을 다운로드합니다.
4. `google-services.json`은 로컬 Android 프로젝트의 `android/app/google-services.json`에 둡니다.

금지:

- `google-services.json`을 Git에 커밋하지 않습니다.
- Firebase Admin SDK private key를 Git에 커밋하지 않습니다.
- 비밀값을 로그나 문서에 남기지 않습니다.

## Android 권한

Android 13 이상에서는 알림 권한이 필요합니다. 앱은 Capacitor Push Notifications 플러그인을 통해 권한을 요청합니다.

권한을 거부해도 CRM 사용 자체는 막지 않습니다. 이 경우 device token 등록만 건너뜁니다.

## Token 저장 정책

서버는 `user_device_tokens` 테이블에 token을 저장합니다.

주요 컬럼:

- userId
- platform: `android`
- token
- deviceId
- appVersion
- deviceModel
- osVersion
- isActive
- lastSeenAt
- createdAt
- updatedAt
- revokedAt

`userId + token` 조합은 중복 저장하지 않습니다. 같은 token이 재등록되면 새 row를 만들지 않고 `lastSeenAt`, device 정보, 활성 상태를 갱신합니다.

## 로그 정책

activity_logs에는 FCM token 원문을 저장하지 않습니다.

로그에는 필요한 경우 아래 값만 남깁니다.

- tokenHash
- tokenMasked
- platform
- deviceId
- appVersion

## inactive/resigned 처리

inactive 또는 resigned 사용자는 device token 등록 API에 접근할 수 없습니다.

향후 PR19-3 알림 발송 단계에서는 아래 기준으로 발송 대상을 제한합니다.

- 사용자 계정 상태가 active
- device token row가 isActive=true
- revokedAt이 null

## 로그아웃 및 세션 무효화

클라이언트 로그아웃 시 현재 기기의 token을 비활성 처리합니다.

관리자 강제 로그아웃 또는 전체 로그아웃 시 해당 사용자 또는 전체 사용자의 active token도 비활성 처리합니다.

## 고객정보 보호

PR19-2는 알림 발송 문구를 만들지 않습니다. PR19-3 이후 실제 푸시 알림을 만들 때도 고객 연락처, 주민등록번호, 증권번호, 병력상세, 상담 메모 전문 등 민감정보를 알림 payload에 포함하지 않습니다.

## 제외 범위

- 실제 FCM 발송
- Firebase Admin SDK 연동
- 업무 알림 스케줄링
- device token 기반 알림 대상 조회 API
- Play Store 배포
- APK/keystore 커밋
 
## Firebase SDK add step verification

The Firebase Console Android "Add Firebase SDK" step is covered by the current Capacitor Android Gradle setup:

1. Project-level Gradle: `android/build.gradle` includes the `com.google.gms:google-services` classpath.
2. App-level Gradle: `android/app/build.gradle` applies `com.google.gms.google-services` only when `android/app/google-services.json` exists locally.
3. Firebase Messaging SDK: `@capacitor/push-notifications` provides the Android `com.google.firebase:firebase-messaging` dependency.

Do not add a duplicate Firebase Messaging SDK or Firebase BOM to the app module unless a future plugin upgrade requires it. If that changes, verify the Capacitor Push Notifications Android Gradle file first and avoid version conflicts.
