# BOA CRM — Flutter (Android)

내부 전용 Android 앱. Play 스토어 배포 없음.

## 사전 준비

- [Flutter SDK](https://docs.flutter.dev/get-started/install/windows) (stable)
- Android Studio + SDK + `local.properties`의 `sdk.dir`
- Firebase Console에서 Android 앱 패키지 **`kr.raonisis.boa`** 등록 후, `google-services.json`을 받아  
  **`android/app/google-services.json`** 에 두기 (Git 커밋 금지 — 루트 `.gitignore`에 이미 포함)

## 첫 생성 (Android 플랫폼 폴더가 없을 때)

이 디렉터리에 `lib/`·`pubspec.yaml`만 있는 상태에서, **한 번** 아래를 실행하면 `android/` 등이 생성됩니다.

```powershell
cd apps\boa
flutter create . --platforms=android --project-name boa --org kr.raonisis
```

생성 후 `android/app/build.gradle.kts`에 Google Services 플러그인을 추가하고(또는 `flutterfire configure` 사용), `google-services.json`을 배치합니다.

## 실행

```powershell
cd apps\boa
flutter pub get
flutter run
```

## 패키지 / 앱 ID

- **applicationId / namespace**: `kr.raonisis.boa` (기존 웹·Capacitor·FCM 정책과 동일)

`flutter create` 직후 `android/app/build.gradle.kts`의 `applicationId`가 다르면 `kr.raonisis.boa`로 맞춥니다.

## 보안

- FCM 토큰 원문을 화면·로그·크래시 리포트에 넣지 않습니다.
- 서버 연동은 기존 BOA CRM API/tRPC 정책을 따릅니다.
