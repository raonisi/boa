/// API 베이스 URL 등 — `--dart-define` 또는 빌드 변형으로 주입 권장.
abstract final class AppConfig {
  /// 예: https://api.example.com  (실제 배포 시 정의)
  static const String apiBaseUrl = String.fromEnvironment(
    'BOA_API_BASE_URL',
    defaultValue: '',
  );

  static bool get hasApiBase => apiBaseUrl.isNotEmpty;
}
