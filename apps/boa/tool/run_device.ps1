# USB 기기에 디버그 실행: SDK Z: 매핑 + dart-define (local_dart_defines.ps1)
$ErrorActionPreference = 'Stop'
$toolDir = $PSScriptRoot
$boaRoot = Join-Path $toolDir '..'

& (Join-Path $toolDir 'map_android_sdk_z.ps1')
$env:ANDROID_SDK_ROOT = 'Z:\'
$env:ANDROID_HOME = 'Z:\'

$local = Join-Path $toolDir 'local_dart_defines.ps1'
$example = Join-Path $toolDir 'local_dart_defines.example.ps1'
if (-not (Test-Path $local)) {
    Write-Host "먼저 다음을 실행하세요:" -ForegroundColor Yellow
    Write-Host "  Copy-Item '$example' '$local'" -ForegroundColor Yellow
    Write-Host "그리고 $local 안의 BOA_* 값을 수정하세요." -ForegroundColor Yellow
    exit 1
}
. $local

if (-not $env:BOA_API_BASE_URL -or -not $env:BOA_GOOGLE_SERVER_CLIENT_ID) {
    throw "local_dart_defines.ps1 에 BOA_API_BASE_URL 과 BOA_GOOGLE_SERVER_CLIENT_ID 를 설정하세요."
}

$flutterBat = if ($env:FLUTTER_ROOT) { Join-Path $env:FLUTTER_ROOT 'bin\flutter.bat' } elseif (Test-Path 'C:\src\flutter\bin\flutter.bat') { 'C:\src\flutter\bin\flutter.bat' } else { 'flutter' }

Push-Location $boaRoot

$runArgs = @('run')
if ($env:FLUTTER_DEVICE_ID) {
    $runArgs += '-d', $env:FLUTTER_DEVICE_ID
}
$runArgs += @(
    '--dart-define=BOA_API_BASE_URL=' + $env:BOA_API_BASE_URL,
    '--dart-define=BOA_GOOGLE_SERVER_CLIENT_ID=' + $env:BOA_GOOGLE_SERVER_CLIENT_ID
)

Write-Host "flutter $($runArgs -join ' ')" -ForegroundColor DarkGray
& $flutterBat @runArgs

Pop-Location
