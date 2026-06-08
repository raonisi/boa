import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final customerDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, customerId) async {
  if (!AppConfig.hasApiBase) {
    throw Exception('BOA_API_BASE_URL 미설정');
  }
  if (ref.watch(sessionProvider) == null) {
    throw Exception('세션 없음');
  }
  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/api/mobile/customers/$customerId');
    final c = res.data?['customer'];
    if (c is! Map<String, dynamic>) {
      throw Exception('고객 데이터 형식 오류');
    }
    return c;
  } on DioException catch (e) {
    final body = e.response?.data;
    String msg = '고객 정보를 불러오지 못했습니다.';
    if (body is Map && body['error'] != null) {
      msg = '${body['error']}';
    } else if (e.message != null) {
      msg = e.message!;
    }
    throw Exception(msg);
  }
});
