import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/contracts/contracts_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 홈 Field Command Center용 최근 계약 스냅샷 (기존 mobile contracts API).
final fieldRecentContractsProvider = FutureProvider.autoDispose<List<BoaContractRow>>((ref) async {
  if (!AppConfig.hasApiBase) {
    throw Exception('BOA_API_BASE_URL 미설정');
  }
  if (ref.watch(sessionProvider) == null) {
    throw Exception('세션 없음');
  }
  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>(
      '/api/mobile/contracts',
      queryParameters: const <String, dynamic>{'limit': 5, 'offset': 0},
    );
    final raw = res.data?['items'];
    if (raw is! List) return const [];
    return raw
        .map((e) => e is Map<String, dynamic> ? e : (e is Map ? Map<String, dynamic>.from(e) : null))
        .whereType<Map<String, dynamic>>()
        .map(BoaContractRow.fromJson)
        .toList();
  } on DioException catch (e) {
    final body = e.response?.data;
    String msg = '계약 목록을 불러오지 못했습니다.';
    if (body is Map && body['error'] != null) msg = '${body['error']}';
    throw Exception(msg);
  }
});
