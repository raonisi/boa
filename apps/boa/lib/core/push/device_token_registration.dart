import 'dart:async';

import 'package:boa/core/push/fcm_registration_logging.dart';
import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

StreamSubscription<String>? _tokenRefreshSub;

/// FCM이 토큰을 갱신할 때마다 서버에 다시 등록합니다. 로그아웃 시 [unbindFcmTokenRefresh]로 해제하세요.
void bindFcmTokenRefresh(Dio dio) {
  unawaited(_tokenRefreshSub?.cancel());
  _tokenRefreshSub = FirebaseMessaging.instance.onTokenRefresh.listen((token) {
    unawaited(registerDeviceTokenWithRetry(dio, token: token));
  });
}

void unbindFcmTokenRefresh() {
  unawaited(_tokenRefreshSub?.cancel());
  _tokenRefreshSub = null;
}

/// FCM 토큰을 서버에 등록합니다. 일시적 네트워크 오류에 대비해 지수 백오프로 최대 3회 시도합니다.
Future<void> registerDeviceTokenWithRetry(Dio dio, {String? token}) async {
  try {
    final t = token ?? await FirebaseMessaging.instance.getToken();
    if (t == null || t.isEmpty) {
      if (kDebugMode) {
        debugPrint('[FCM] device token registration skipped');
      }
      return;
    }
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        await dio.post<void>(
          '/api/mobile/device-tokens/register',
          data: <String, dynamic>{
            'token': t,
            'platform': 'android',
          },
        );
        if (kDebugMode) {
          debugPrint('[FCM] device token registered');
        }
        return;
      } catch (e) {
        if (attempt == 2) {
          logFcmRegistrationFailure('device token registration failed', e);
          return;
        }
        await Future<void>.delayed(Duration(seconds: 1 << attempt));
      }
    }
  } catch (e) {
    logFcmRegistrationFailure('device token registration failed', e);
  }
}
