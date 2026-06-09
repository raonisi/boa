/// WebView 오류를 사용자 안내 문구로 변환 — URL·token·secret 노출 금지.
String userFacingWebViewError(String? raw) {
  if (raw == null || raw.trim().isEmpty) {
    return '화면을 불러오지 못했습니다.';
  }

  final upper = raw.toUpperCase();

  if (_looksLikeSensitive(raw)) {
    return _classifyError(upper);
  }

  if (upper.contains('ERR_HTTP2') ||
      (upper.contains('HTTP2') && upper.contains('PROTOCOL'))) {
    return '화면을 불러오지 못했습니다. Chrome 탭으로 열기를 시도해 주세요.';
  }

  return _classifyError(upper);
}

bool _looksLikeSensitive(String raw) {
  if (raw.contains('://')) return true;
  if (raw.contains('Bearer ') || raw.contains('bearer ')) return true;
  if (RegExp(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+').hasMatch(raw)) return true;
  if (raw.length > 160) return true;
  return false;
}

String _classifyError(String upper) {
  if (upper.contains('401') ||
      upper.contains('UNAUTHORIZED') ||
      upper.contains('UNAUTHENTICATED') ||
      upper.contains('SESSION') && upper.contains('EXPIR')) {
    return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  }
  if (upper.contains('403') ||
      upper.contains('FORBIDDEN') ||
      upper.contains('NOT ALLOWED') ||
      upper.contains('PERMISSION')) {
    return '권한이 필요한 관리자 화면입니다.';
  }
  if (upper.contains('ERR_INTERNET_DISCONNECTED') ||
      upper.contains('ERR_NETWORK') ||
      upper.contains('ERR_CONNECTION') ||
      upper.contains('ERR_NAME_NOT_RESOLVED') ||
      upper.contains('NET::') ||
      upper.contains('NETWORK') ||
      upper.contains('OFFLINE')) {
    return '네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
  }
  if (upper.contains('ERR_HTTP2') ||
      (upper.contains('HTTP2') && upper.contains('PROTOCOL'))) {
    return '화면을 불러오지 못했습니다. Chrome 탭으로 열기를 시도해 주세요.';
  }
  if (upper.contains('TIMEOUT') || upper.contains('TIMED OUT')) {
    return '응답 시간이 초과되었습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
  }
  return '화면을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
}

bool webViewErrorLooksLikeHttp2(String? message) {
  if (message == null) return false;
  final upper = message.toUpperCase();
  return upper.contains('ERR_HTTP2') ||
      (upper.contains('HTTP2') && upper.contains('PROTOCOL'));
}
