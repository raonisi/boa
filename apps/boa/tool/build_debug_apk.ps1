# 디버그 APK: SDK Z: 매핑 + dart-define (local_dart_defines.ps1)
$ErrorActionPreference = 'Stop'
$toolDir = $PSScriptRoot
$boaRoot = Join-Path $toolDir '..'

& (Join-Path $toolDir 'map_android_sdk_z.ps1')
$env:ANDROID_SDK_ROOT = 'Z:\'
$env:ANDROID_HOME = 'Z:\'

$local = Join-Path $toolDir 'local_dart_defines.ps1'
if (-not (Test-Path $local)) {
    throw "local_dart_defines.ps1 이 없습니다. local_dart_defines.example.ps1 을 복사해 만드세요."
}
. $local

if (-not $env:BOA_API_BASE_URL -or -not $env:BOA_GOOGLE_SERVER_CLIENT_ID) {
    throw "local_dart_defines.ps1 에 BOA_* 변수를 설정하세요."
}

$flutterBat = if ($env:FLUTTER_ROOT) { Join-Path $env:FLUTTER_ROOT 'bin\flutter.bat' } elseif (Test-Path 'C:\src\flutter\bin\flutter.bat') { 'C:\src\flutter\bin\flutter.bat' } else { 'flutter' }

Push-Location $boaRoot
& $flutterBat @(
    'build', 'apk', '--debug',
    '--dart-define=BOA_API_BASE_URL=' + $env:BOA_API_BASE_URL,
    '--dart-define=BOA_GOOGLE_SERVER_CLIENT_ID=' + $env:BOA_GOOGLE_SERVER_CLIENT_ID
)
Pop-Location

Write-Host "APK: $boaRoot\build\app\outputs\flutter-apk\app-debug.apk" -ForegroundColor Green
