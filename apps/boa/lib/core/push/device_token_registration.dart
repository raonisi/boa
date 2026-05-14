import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// FCM 토큰을 서버에 등록합니다. 일시적 네트워크 오류에 대비해 지수 백오프로 최대 3회 시도합니다.
Future<void> registerDeviceTokenWithRetry(Dio dio) async {
  try {
    final token = await FirebaseMessaging.instance.getToken();
    if (token == null || token.isEmpty) {
      if (kDebugMode) {
        debugPrint('[FCM] no token (Firebase 미설정 또는 권한 없음)');
      }
      return;
    }
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        await dio.post<void>(
          '/api/mobile/device-tokens/register',
          data: <String, dynamic>{
            'token': token,
            'platform': 'android',
          },
        );
        if (kDebugMode) {
          debugPrint('[FCM] device token registered');
        }
        return;
      } catch (e) {
        if (attempt == 2) {
          if (kDebugMode) {
            debugPrint('[FCM] register failed after retries: $e');
          }
          return;
        }
        await Future<void>.delayed(Duration(seconds: 1 << attempt));
      }
    }
  } catch (e, st) {
    if (kDebugMode) {
      debugPrint('[FCM] registerDeviceTokenWithRetry: $e');
      debugPrintStack(stackTrace: st);
    }
  }
}
