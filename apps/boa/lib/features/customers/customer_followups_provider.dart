import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final customerFollowUpsProvider = FutureProvider.autoDispose.family<List<Map<String, dynamic>>, int>((ref, customerId) async {
  if (!AppConfig.hasApiBase) return const [];
  if (ref.watch(sessionProvider) == null) return const [];
  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/api/mobile/customers/$customerId/follow-ups');
    final raw = res.data?['items'];
    if (raw is! List) return const [];
    return raw
        .map((e) => e is Map<String, dynamic> ? e : (e is Map ? Map<String, dynamic>.from(e) : null))
        .whereType<Map<String, dynamic>>()
        .toList();
  } on DioException catch (e) {
    final body = e.response?.data;
    String msg = '후속관리를 불러오지 못했습니다.';
    if (body is Map && body['error'] != null) msg = '${body['error']}';
    throw Exception(msg);
  }
});
