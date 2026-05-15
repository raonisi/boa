# Map Android SDK to Z: so NDK paths avoid non-ASCII user profile (Windows ninja/CMake issue).
# Run once per new PowerShell session before flutter run / build.
$ErrorActionPreference = 'Stop'
$boaRoot = Split-Path -Parent $PSScriptRoot
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$props = Join-Path $boaRoot 'android\local.properties'
if (-not (Test-Path $sdk)) { throw "SDK not found: $sdk" }
subst Z: /d 2>$null | Out-Null
subst Z: $sdk
$flutterSdk = 'C:\\src\\flutter'
if (Test-Path $props) {
  $m = Select-String -Path $props -Pattern '^flutter\.sdk=(.+)$' | Select-Object -First 1
  if ($m) { $flutterSdk = $m.Matches[0].Groups[1].Value.Trim() }
}
@"
sdk.dir=Z\:\\
flutter.sdk=$flutterSdk
flutter.buildMode=debug
flutter.versionName=0.1.0
flutter.versionCode=1
"@ | Set-Content -Encoding ASCII -Path $props
Write-Host "OK: Z: -> $sdk"
Write-Host "Updated: $props"
