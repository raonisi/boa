# BOA CRM — Flutter (Android)

내부 전용 Android 앱. Play 스토어 배포 없음.

## 사전 준비

- [Flutter SDK](https://docs.flutter.dev/get-started/install/windows) (stable)
- Android Studio + SDK + `local.properties`의 `sdk.dir`
- Firebase Console에서 Android 앱 패키지 **`kr.raonisis.boa`** 등록 후, 받은 **`google-services.json`** 을 로컬에만 두세요.  
  **경로: `apps/boa/android/app/google-services.json`** (이 파일은 Git에 올리지 마세요. 루트 `.gitignore`에 `google-services.json` 패턴이 있습니다.)
- `android/app/build.gradle.kts`는 **`google-services.json` 이 있을 때만** `com.google.gms.google-services` 플러그인을 적용합니다.

## Android 폴더가 없을 때

이 저장소에는 이미 `android/` Gradle 프로젝트가 포함되어 있습니다.  
다만 `local.properties`의 `flutter.sdk` 등은 로컬에서 `flutter pub get` 또는 Android Studio가 채웁니다.  
템플릿을 다시 맞추고 싶다면(주의: 기존 `android/` 수정분이 덮어쓰일 수 있음):

```powershell
cd apps\boa
flutter create . --platforms=android --project-name boa --org kr.raonisis
```

이후에도 **`applicationId` / `namespace` 는 `kr.raonisis.boa`** 로 유지해야 Firebase·OAuth 앱과 일치합니다.

## 실행

```powershell
cd apps\boa
flutter pub get
# 로컬 서버(예: PC에서 pnpm dev → 3000) + 에뮬레이터: BOA_API_BASE_URL=http://10.0.2.2:3000
# BOA_GOOGLE_SERVER_CLIENT_ID 는 서버의 GOOGLE_CLIENT_ID(웹 클라이언트 ID)와 동일해야 합니다.
flutter run --dart-define=BOA_API_BASE_URL=http://10.0.2.2:3000 --dart-define=BOA_GOOGLE_SERVER_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

HTTP(비 TLS)로 붙을 때는 `android` 폴더 생성 후 디버그 빌드에서 cleartext 허용이 필요할 수 있습니다(에뮬레이터 → 호스트 `http://10.0.2.2`).

## 패키지 / 앱 ID

- **applicationId / namespace**: `kr.raonisis.boa` (기존 웹·Capacitor·FCM 정책과 동일)

`flutter create` 로 `android/`를 다시 만들었다면 `android/app/build.gradle.kts`의 `applicationId`·`namespace`가 바뀌지 않았는지 확인하고, 필요 시 다시 `kr.raonisis.boa`로 맞춥니다.

## 보안

- FCM 토큰 원문을 화면·로그·크래시 리포트에 넣지 않습니다.
- 서버 연동은 기존 BOA CRM API/tRPC 정책을 따릅니다.
