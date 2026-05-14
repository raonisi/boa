import 'package:boa/core/config/app_config.dart';
import 'package:dio/dio.dart';

/// 인터셉터 없음 — 세션 복원 등 부트스트랩 전용.
Dio createPlainDio() {
  return Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      headers: const {'Accept': 'application/json'},
    ),
  );
}
