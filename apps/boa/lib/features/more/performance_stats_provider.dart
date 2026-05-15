import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

String _dateOnly(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// 이번 달 계약일 기준 실적 요약 (`performance.stats`).
final performanceStatsProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  if (!AppConfig.hasApiBase) return null;
  if (ref.watch(sessionProvider) == null) return null;
  final dio = ref.watch(dioProvider);
  final now = DateTime.now();
  final from = DateTime(now.year, now.month, 1);
  final to = DateTime(now.year, now.month + 1, 0);
  try {
    final res = await dio.get<Map<String, dynamic>>(
      '/api/mobile/performance/stats',
      queryParameters: <String, dynamic>{
        'dateFrom': _dateOnly(from),
        'dateTo': _dateOnly(to),
      },
    );
    return res.data;
  } on DioException catch (e) {
    final body = e.response?.data;
    String msg = '실적을 불러오지 못했습니다.';
    if (body is Map && body['error'] != null) msg = '${body['error']}';
    throw Exception(msg);
  }
});
