/// 사용자 화면용 오류 문구 — raw exception 노출 방지
String boaUserFacingErrorMessage(Object? error, {String? fallback}) {
  final resolved = fallback ?? '처리하지 못했습니다. 다시 시도해 주세요.';
  if (error == null) return resolved;

  final message = error.toString().trim();
  if (message.isEmpty) return resolved;

  final lower = message.toLowerCase();
  if (message.contains(' at ') ||
      message.length > 160 ||
      lower.contains('exception') ||
      lower.contains('stacktrace') ||
      lower.startsWith('failed') ||
      lower.startsWith('error:') ||
      lower.contains('unauthorized') ||
      lower.contains('forbidden')) {
    return resolved;
  }

  if (RegExp(r'[가-힣]').hasMatch(message)) {
    return message;
  }

  return resolved;
}
