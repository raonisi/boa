import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final unreadNotificationCountProvider = FutureProvider.autoDispose<int>((ref) async {
  if (!AppConfig.hasApiBase) return 0;
  if (ref.watch(sessionProvider) == null) return 0;
  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/api/mobile/notifications/unread-count');
    final n = res.data?['count'];
    if (n is int) return n;
    if (n is num) return n.toInt();
    return 0;
  } on DioException {
    return 0;
  }
});
