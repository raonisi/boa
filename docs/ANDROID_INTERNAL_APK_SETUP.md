# BOA 지점관리 CRM Android 내부 APK 설정

## 목적

BOA 지점관리 CRM을 Play Store 배포가 아닌 내부 APK 파일로 설치해 사용하기 위한 Android 앱 셸입니다.

## 앱 정보

- App ID: kr.raonisis.boa
- App Name: BOA 지점관리 CRM
- Web URL: https://raonisis.kr
- Web Dir: dist/public

## 빌드 전 준비

- Android Studio
- Android SDK
- Android SDK Command-line Tools
- Android SDK Platform-Tools
- Android SDK Build-Tools
- JDK

## 검증 명령

pnpm.cmd check
pnpm.cmd test
pnpm.cmd build
pnpm.cmd exec cap sync android

cd android
.\gradlew.bat assembleDebug
cd ..

## APK 위치

android/app/build/outputs/apk/debug/app-debug.apk

## 내부 설치 방식

APK 파일을 휴대폰으로 전송한 뒤 휴대폰에서 직접 설치합니다.
USB 디버깅이 없어도 직접 설치는 가능합니다.

## Git 커밋 금지 파일

아래 파일은 Git에 커밋하지 않습니다.

- \*.apk
- \*.aab
- \*.jks
- \*.keystore
- google-services.json
- local.properties
- android/local.properties
- .env
- .env.local
- .env.production

## 제외 범위

- Firebase/FCM 알림 기능은 PR19-2 이후 작업
- Play Store 배포는 현재 제외
- DB/API/권한/scope 변경 없음
