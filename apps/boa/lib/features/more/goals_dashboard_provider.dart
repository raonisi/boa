import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// `performanceGoals.dashboard` — 기본값: 올해·이번 달.
final goalsDashboardProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  if (!AppConfig.hasApiBase) return null;
  if (ref.watch(sessionProvider) == null) return null;
  final dio = ref.watch(dioProvider);
  final now = DateTime.now();
  try {
    final res = await dio.get<Map<String, dynamic>>(
      '/api/mobile/performance-goals/dashboard',
      queryParameters: <String, dynamic>{
        'year': now.year,
        'month': now.month,
      },
    );
    return res.data;
  } on DioException catch (e) {
    final body = e.response?.data;
    String msg = '목표 대시보드를 불러오지 못했습니다.';
    if (body is Map && body['error'] != null) msg = '${body['error']}';
    throw Exception(msg);
  }
});
