/// API 베이스 URL 등 — `--dart-define`으로 덮어쓰기(로컬 서버 등). 미지정 시에는 아래 기본값을 사용합니다.
///
/// 빌드 도구가 `BOA_*=` 처럼 **빈 dart-define만 넘기는 경우**에는 `String.fromEnvironment`의
/// `defaultValue`가 적용되지 않을 수 있어, getter에서 trim 후 비어 있으면 동일 기본값을 씁니다.
abstract final class AppConfig {
  static const String _defaultApiBase = 'https://raonisis.kr';
  static const String _defaultGoogleServerClientId =
      '82105557713-kcfit7482hk5f36gdlfqloh2e0rugjsh.apps.googleusercontent.com';

  /// 예: `http://10.0.2.2:3000` (에뮬레이터에서 PC의 로컬 서버), 또는 `https://crm.example.com`
  static String get apiBaseUrl {
    const v = String.fromEnvironment('BOA_API_BASE_URL', defaultValue: _defaultApiBase);
    final t = v.trim();
    return t.isNotEmpty ? t : _defaultApiBase;
  }

  /// 웹 CRM 루트 (SPA). 비어 있으면 [apiBaseUrl]의 스킴·호스트·포트만 사용합니다.
  static String get webBaseUrl {
    const v = String.fromEnvironment('BOA_WEB_BASE_URL', defaultValue: '');
    return v.trim();
  }

  /// Google Sign-In `id_token` 발급용 웹 클라이언트 ID — 서버 `GOOGLE_CLIENT_ID`와 동일해야 `aud` 검증에 통과합니다.
  static String get googleServerClientId {
    const v = String.fromEnvironment(
      'BOA_GOOGLE_SERVER_CLIENT_ID',
      defaultValue: _defaultGoogleServerClientId,
    );
    final t = v.trim();
    return t.isNotEmpty ? t : _defaultGoogleServerClientId;
  }

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
