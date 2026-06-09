import 'package:boa/features/web/crm_web_error_messages.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('userFacingWebViewError', () {
    test('maps network errors', () {
      expect(
        userFacingWebViewError('net::ERR_INTERNET_DISCONNECTED'),
        contains('네트워크'),
      );
    });

    test('maps auth errors without exposing raw token', () {
      expect(
        userFacingWebViewError('HTTP 401 Unauthorized'),
        '로그인이 만료되었습니다. 다시 로그인해 주세요.',
      );
    });

    test('maps forbidden errors', () {
      expect(
        userFacingWebViewError('403 Forbidden'),
        '권한이 필요한 관리자 화면입니다.',
      );
    });

    test('sanitizes URLs and JWT-like strings', () {
      final msg = userFacingWebViewError(
        'Failed https://raonisis.kr/customers?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
      );
      expect(msg.contains('https://'), isFalse);
      expect(msg.contains('eyJ'), isFalse);
      expect(msg, isNotEmpty);
    });

    test('detects http2 failures', () {
      expect(webViewErrorLooksLikeHttp2('net::ERR_HTTP2_PROTOCOL_ERROR'), isTrue);
    });
  });
}
