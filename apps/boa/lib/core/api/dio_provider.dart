import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Accept': 'application/json'},
    ),
  );
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final path = options.uri.path;
        final isGoogleAuth = path.contains('/api/mobile/auth/google');
        if (!isGoogleAuth) {
          final session = ref.read(sessionProvider);
          final token = session?.sessionToken;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
        }
        return handler.next(options);
      },
      onResponse: (response, handler) {
        if (response.statusCode == 401) {
          final path = response.requestOptions.uri.path;
          if (!path.contains('/api/mobile/auth/google')) {
            ref.read(sessionProvider.notifier).signOut();
          }
        }
        handler.next(response);
      },
      onError: (DioException e, ErrorInterceptorHandler handler) {
        final code = e.response?.statusCode;
        if (code == 401) {
          final path = e.requestOptions.uri.path;
          if (!path.contains('/api/mobile/auth/google')) {
            ref.read(sessionProvider.notifier).signOut();
          }
        }
        handler.next(e);
      },
    ),
  );
  return dio;
});
