import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Safe FCM registration failure reason — no tokens, headers, or raw bodies.
String fcmRegistrationFailureReason(Object? error) {
  if (error is DioException) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'timeout';
      case DioExceptionType.connectionError:
        return 'network_error';
      case DioExceptionType.badCertificate:
        return 'network_error';
      case DioExceptionType.cancel:
        return 'cancelled';
      case DioExceptionType.badResponse:
      case DioExceptionType.unknown:
        break;
    }

    final status = error.response?.statusCode;
    if (status == 401 || status == 403) return 'auth_required';
    if (status != null && status >= 500) return 'server_error';
    if (status != null && status >= 400) return 'client_error';
    return 'unknown_registration_error';
  }

  return 'unknown_registration_error';
}

void logFcmRegistrationFailure(String context, Object? error) {
  if (!kDebugMode) return;
  debugPrint('[FCM] $context: ${fcmRegistrationFailureReason(error)}');
}
