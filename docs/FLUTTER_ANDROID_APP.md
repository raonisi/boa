# BOA CRM — Flutter Android 앱

## 위치

- 소스: `apps/boa/`
- 패키지 ID: **`kr.raonisis.boa`** (Firebase·기존 Capacitor 정책과 동일)

## 첫 설정

1. [Flutter](https://docs.flutter.dev/get-started/install/windows) 설치 후 `flutter doctor`.
2. 이 디렉터리에서 Android 플랫폼 생성 (최초 1회):

```bash
cd apps/boa
flutter create . --platforms=android --project-name boa --org kr.raonisis
```

3. `android/app/build.gradle.kts`의 `applicationId`가 **`kr.raonisis.boa`** 인지 확인.
4. Firebase에서 받은 `google-services.json`을 `android/app/`에 두기 (저장소에 커밋하지 않음).

## 실행

```bash
flutter pub get
flutter run
```

## 기능 범위

웹 CRM(`client/src/App.tsx` 라우트)과 **동일 기능**을 목표로 하며, 현재 저장소의 Dart 코드는 **셸·내비·M3 테마·인증 스텁**까지입니다. 이후 모듈별로 API를 연결합니다.

## FCM

- `firebase_core` / `firebase_messaging` 의존성 포함.
- `lib/core/push/firebase_bootstrap.dart`에서 초기화(설정 전에는 catch로 무해 실패).
- 토큰 원문은 로그·UI에 출력하지 않습니다.
