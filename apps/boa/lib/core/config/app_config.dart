/// API 베이스 URL 등 — `--dart-define` 또는 빌드 변형으로 주입 권장.
abstract final class AppConfig {
  /// 예: `http://10.0.2.2:3000` (에뮬레이터에서 PC의 로컬 서버), 또는 `https://crm.example.com`
  static const String apiBaseUrl = String.fromEnvironment(
    'BOA_API_BASE_URL',
    defaultValue: '',
  );

  /// 웹 CRM 루트 (SPA). 비어 있으면 [apiBaseUrl]의 스킴·호스트·포트만 사용합니다.
  static const String webBaseUrl = String.fromEnvironment(
    'BOA_WEB_BASE_URL',
    defaultValue: '',
  );

  /// Google Sign-In `id_token` 발급용 웹 클라이언트 ID — 서버 `GOOGLE_CLIENT_ID`와 동일해야 `aud` 검증에 통과합니다.
  static const String googleServerClientId = String.fromEnvironment(
    'BOA_GOOGLE_SERVER_CLIENT_ID',
    defaultValue: '',
  );

  static bool get hasApiBase => apiBaseUrl.isNotEmpty;

  static bool get hasGoogleServerClientId => googleServerClientId.isNotEmpty;

  /// Drawer 웹 포털 등에 사용. `BOA_WEB_BASE_URL` 우선, 없으면 API 베이스와 동일 오리진.
  static String? get resolvedWebBaseOrigin {
    final w = webBaseUrl.trim();
    if (w.isNotEmpty) {
      return _stripTrailingSlash(w);
    }
    if (!hasApiBase) return null;
    return _originFromApiBase(apiBaseUrl);
  }

  static bool get hasWebPortalBase => resolvedWebBaseOrigin != null;

  static String _stripTrailingSlash(String s) {
    if (s.length <= 1) return s;
    return s.endsWith('/') ? s.substring(0, s.length - 1) : s;
  }

  static String? _originFromApiBase(String api) {
    try {
      final u = Uri.parse(api);
      if (!u.hasScheme || u.host.isEmpty) return null;
      final origin = Uri(
        scheme: u.scheme,
        host: u.host,
        port: u.hasPort ? u.port : null,
      );
      return origin.toString();
    } catch (_) {
      return null;
    }
  }
}
