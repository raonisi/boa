# Android 내부 APK 앱 셸 설정

## 목적

PR19-1은 BOA 지점관리 CRM을 Play Store 배포가 아닌 내부 APK 파일로 설치해 사용할 수 있도록 Capacitor 기반 Android 앱 셸을 추가합니다.

이번 단계는 기존 웹앱을 Android WebView에서 실행하는 앱 껍데기입니다. Firebase, FCM, device token 저장, 업무 알림 발송은 PR19-2 이후 별도 작업입니다.

## 기본 설정

- Capacitor appId: `kr.raonisis.boa`
- Capacitor appName: `BOA 지점관리 CRM`
- webDir: `dist/public`
- Android 로딩 URL: `https://raonisis.kr`

## 로딩 방식

내부 APK 운영에서는 운영 웹 도메인 `https://raonisis.kr`을 WebView에서 로드합니다.

이 방식을 선택한 이유:

- Railway 웹 배포가 그대로 유지됩니다.
- 웹 UI/기능 배포 후 APK 재배포 없이 최신 화면을 볼 수 있습니다.
- Google OAuth redirect URI가 기존 운영 도메인 기준으로 유지됩니다.

주의:

- 네트워크 연결이 필요합니다.
- Google OAuth가 WebView 환경에서 제한될 수 있으므로 실제 Android 기기에서 로그인 검수를 해야 합니다.
- OAuth 구조 변경, native OAuth, Custom Tabs 도입은 이번 PR 범위가 아닙니다.

## 개발 환경

필요 도구:

- Node.js / pnpm
- Android Studio
- Android SDK
- JDK

## 빌드 및 동기화

```powershell
pnpm.cmd install
pnpm.cmd build
npx cap sync android
```

Android Studio에서 열기:

```powershell
npx cap open android
```

## Debug APK 생성

Android Studio에서 `Build > Build Bundle(s) / APK(s) > Build APK(s)`를 사용하거나, 로컬 Android Gradle 환경이 준비된 경우:

```powershell
cd android
.\gradlew.bat assembleDebug
```

생성된 APK 파일은 Git에 커밋하지 않습니다.

## Release APK 서명

내부 배포용 release APK가 필요하면 별도 keystore를 로컬 안전 위치에 보관하고 Gradle signing 설정을 합니다.

금지:

- `.jks`
- `.keystore`
- APK/AAB 산출물
- `google-services.json`
- `.env`
- 비밀값

위 파일은 Git에 커밋하지 않습니다.

## APK 설치

내부 테스트 기기에서 APK 파일을 전달받아 설치합니다. 기기 설정에서 출처를 알 수 없는 앱 설치 허용이 필요할 수 있습니다.

## 업데이트 방식

- 웹 UI/API 변경은 Railway 배포로 반영됩니다.
- Android 네이티브 설정, 앱 아이콘, FCM, 권한 설정 변경은 APK 재빌드 및 재배포가 필요합니다.

## 제외 범위

- Play Store 배포
- Firebase/FCM 연동
- device token 저장
- 업무 알림 발송
- 운영 DB migration
- API/권한/scope 변경

## 운영 주의사항

- 실제 고객정보로 테스트하지 않습니다.
- 운영 DB에서 reset, drop, hard delete를 수행하지 않습니다.
- activity_logs를 삭제하지 않습니다.
- 비밀값을 로그, 문서, Git에 남기지 않습니다.
