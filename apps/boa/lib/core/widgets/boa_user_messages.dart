// 사용자 화면용 오류 문구 — raw exception 노출 방지.
import 'package:dio/dio.dart';
enum BoaUserErrorContext {
  generic,
  customer,
  contract,
  contractCreate,
  notification,
  schedule,
  followUp,
  goal,
  performance,
  search,
  webView,
  auth,
  pushPreferences,
}

const Map<BoaUserErrorContext, String> _contextFallbacks = {
  BoaUserErrorContext.generic: '처리하지 못했습니다. 다시 시도해 주세요.',
  BoaUserErrorContext.customer: '고객 정보를 불러오지 못했습니다. 다시 시도해 주세요.',
  BoaUserErrorContext.contract: '계약 정보를 불러오지 못했습니다. 다시 시도해 주세요.',
  BoaUserErrorContext.contractCreate: '계약 등록 중 문제가 발생했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.',
  BoaUserErrorContext.notification: '알림 정보를 불러오지 못했습니다. 다시 시도해 주세요.',
  BoaUserErrorContext.schedule: '일정 정보를 불러오지 못했습니다. 다시 시도해 주세요.',
  BoaUserErrorContext.followUp: '후속관리 정보를 불러오지 못했습니다. 다시 시도해 주세요.',
  BoaUserErrorContext.goal: '목표 정보를 불러오지 못했습니다. 다시 시도해 주세요.',
  BoaUserErrorContext.performance: '실적 정보를 불러오지 못했습니다. 다시 시도해 주세요.',
  BoaUserErrorContext.search: '검색 결과를 불러오지 못했습니다. 다시 시도해 주세요.',
  BoaUserErrorContext.webView: '화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
  BoaUserErrorContext.auth: '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  BoaUserErrorContext.pushPreferences: '알림 설정을 처리하지 못했습니다. 다시 시도해 주세요.',
};

String _resolveFallback({
  BoaUserErrorContext? context,
  String? fallback,
}) {
  if (fallback != null && fallback.trim().isNotEmpty) return fallback.trim();
  return _contextFallbacks[context ?? BoaUserErrorContext.generic] ??
      _contextFallbacks[BoaUserErrorContext.generic]!;
}

bool _looksLikeUnsafeUserMessage(String message) {
  final lower = message.toLowerCase();
  return message.contains(' at ') ||
      message.length > 160 ||
      lower.contains('exception') ||
      lower.contains('stacktrace') ||
      lower.contains('dioexception') ||
      lower.contains('socketexception') ||
      lower.contains('timeoutexception') ||
      lower.contains('instance of') ||
      lower.startsWith('failed') ||
      lower.startsWith('error:') ||
      lower.contains('unauthorized') ||
      lower.contains('forbidden') ||
      lower.contains('bad response') ||
      lower.contains('http://') ||
      lower.contains('https://') ||
      lower.contains('token') ||
      lower.contains('bearer') ||
      lower == 'null' ||
      lower == 'unknown' ||
      lower == 'error' ||
      lower == 'retry';
}

String? _safeServerErrorMessage(Object? error) {
  if (error is! DioException) return null;
  final data = error.response?.data;
  if (data is! Map) return null;
  final raw = data['error'];
  if (raw == null) return null;
  final message = '$raw'.trim();
  if (message.isEmpty || _looksLikeUnsafeUserMessage(message)) return null;
  if (RegExp(r'[가-힣]').hasMatch(message)) return message;
  return null;
}

String boaUserFacingErrorMessage(
  Object? error, {
  BoaUserErrorContext? context,
  String? fallback,
}) {
  final resolved = _resolveFallback(context: context, fallback: fallback);
  final serverMessage = _safeServerErrorMessage(error);
  if (serverMessage != null) return serverMessage;
  if (error == null) return resolved;

  final message = error.toString().trim();
  if (message.isEmpty) return resolved;
  if (_looksLikeUnsafeUserMessage(message)) return resolved;

  if (RegExp(r'[가-힣]').hasMatch(message)) {
    return message;
  }

  return resolved;
}
