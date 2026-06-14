import 'package:boa/core/push/fcm_registration_logging.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('fcmRegistrationFailureReason', () {
    test('maps timeout DioException without leaking request data', () {
      final reason = fcmRegistrationFailureReason(
        DioException(
          requestOptions: RequestOptions(path: '/api/mobile/device-tokens/register'),
          type: DioExceptionType.connectionTimeout,
        ),
      );

      expect(reason, 'timeout');
    });

    test('maps auth status without exposing response body', () {
      final reason = fcmRegistrationFailureReason(
        DioException(
          requestOptions: RequestOptions(path: '/api/mobile/device-tokens/register'),
          type: DioExceptionType.badResponse,
          response: Response(
            requestOptions: RequestOptions(path: '/api/mobile/device-tokens/register'),
            statusCode: 401,
            data: {'token': 'secret-device-token'},
          ),
        ),
      );

      expect(reason, 'auth_required');
    });
  });
}
