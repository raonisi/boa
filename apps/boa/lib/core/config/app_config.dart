/// API 베이스 URL 등 — `--dart-define` 또는 빌드 변형으로 주입 권장.
abstract final class AppConfig {
  /// 예: `http://10.0.2.2:3000` (에뮬레이터에서 PC의 로컬 서버), 또는 `https://crm.example.com`
  static const String apiBaseUrl = String.fromEnvironment(
    'BOA_API_BASE_URL',
    defaultValue: '',
  );

  /// Google Sign-In `id_token` 발급용 웹 클라이언트 ID — 서버 `GOOGLE_CLIENT_ID`와 동일해야 `aud` 검증에 통과합니다.
  static const String googleServerClientId = String.fromEnvironment(
    'BOA_GOOGLE_SERVER_CLIENT_ID',
    defaultValue: '',
  );

  static bool get hasApiBase => apiBaseUrl.isNotEmpty;

  static bool get hasGoogleServerClientId => googleServerClientId.isNotEmpty;
}
