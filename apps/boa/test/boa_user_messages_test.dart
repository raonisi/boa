import 'package:boa/core/widgets/boa_user_messages.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('boaUserFacingErrorMessage', () {
    test('returns context fallback for DioException', () {
      final message = boaUserFacingErrorMessage(
        DioException(requestOptions: RequestOptions(path: '/test'), message: 'bad response'),
        context: BoaUserErrorContext.goal,
      );
      expect(message, '목표 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
      expect(message.toLowerCase(), isNot(contains('dioexception')));
    });

    test('returns context fallback for raw exception strings', () {
      expect(
        boaUserFacingErrorMessage(Exception('SocketException: failed')),
        '처리하지 못했습니다. 다시 시도해 주세요.',
      );
    });

    test('preserves safe Korean server messages from Dio response', () {
      final message = boaUserFacingErrorMessage(
        DioException(
          requestOptions: RequestOptions(path: '/test'),
          response: Response(
            requestOptions: RequestOptions(path: '/test'),
            data: {'error': '권한이 없습니다. 관리자에게 문의해 주세요.'},
          ),
        ),
        context: BoaUserErrorContext.auth,
      );
      expect(message, '권한이 없습니다. 관리자에게 문의해 주세요.');
    });
  });
}
