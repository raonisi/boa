import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class DashboardCards {
  const DashboardCards({
    required this.todayScheduleCount,
    required this.incompleteScheduleCount,
    required this.pendingNotificationCount,
    required this.longUnmanagedCustomerCount,
    required this.monthlyContractCount,
    required this.monthlyPremiumSum,
    required this.todayFollowUpCount,
    required this.overdueFollowUpCount,
  });

  final int todayScheduleCount;
  final int incompleteScheduleCount;
  final int pendingNotificationCount;
  final int longUnmanagedCustomerCount;
  final int monthlyContractCount;
  final int monthlyPremiumSum;
  final int todayFollowUpCount;
  final int overdueFollowUpCount;

  factory DashboardCards.fromJson(Object? raw) {
    final m = raw is Map<String, dynamic> ? raw : <String, dynamic>{};
    int n(String k) => (m[k] as num?)?.toInt() ?? 0;
    return DashboardCards(
      todayScheduleCount: n('todayScheduleCount'),
      incompleteScheduleCount: n('incompleteScheduleCount'),
      pendingNotificationCount: n('pendingNotificationCount'),
      longUnmanagedCustomerCount: n('longUnmanagedCustomerCount'),
      monthlyContractCount: n('monthlyContractCount'),
      monthlyPremiumSum: n('monthlyPremiumSum'),
      todayFollowUpCount: n('todayFollowUpCount'),
      overdueFollowUpCount: n('overdueFollowUpCount'),
    );
  }
}

class DashboardTodayPayload {
  const DashboardTodayPayload({
    required this.scope,
    required this.cards,
    required this.todaySchedules,
    required this.incompleteSchedules,
    required this.pendingNotifications,
  });

  final String? scope;
  final DashboardCards cards;
  final List<Map<String, dynamic>> todaySchedules;
  final List<Map<String, dynamic>> incompleteSchedules;
  final List<Map<String, dynamic>> pendingNotifications;

  factory DashboardTodayPayload.fromJson(Map<String, dynamic> json) {
    List<Map<String, dynamic>> listOfMaps(String key) {
      final v = json[key];
      if (v is! List) return const [];
      return v
          .map((e) => e is Map<String, dynamic> ? e : (e is Map ? Map<String, dynamic>.from(e) : null))
          .whereType<Map<String, dynamic>>()
          .toList();
    }

    return DashboardTodayPayload(
      scope: json['scope'] as String?,
      cards: DashboardCards.fromJson(json['cards']),
      todaySchedules: listOfMaps('todaySchedules'),
      incompleteSchedules: listOfMaps('incompleteSchedules'),
      pendingNotifications: listOfMaps('pendingNotifications'),
    );
  }
}

final dashboardTodayWorkProvider = FutureProvider.autoDispose<DashboardTodayPayload>((ref) async {
  if (!AppConfig.hasApiBase) {
    throw Exception('BOA_API_BASE_URL 미설정');
  }
  final session = ref.watch(sessionProvider);
  if (session == null) {
    throw Exception('세션 없음');
  }
  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/api/mobile/dashboard/today-work');
    final data = res.data;
    if (data == null) {
      throw Exception('응답이 비어 있습니다.');
    }
    return DashboardTodayPayload.fromJson(data);
  } on DioException catch (e) {
    final body = e.response?.data;
    String msg = '대시보드를 불러오지 못했습니다.';
    if (body is Map && body['error'] != null) {
      msg = '${body['error']}';
    } else if (e.message != null) {
      msg = e.message!;
    }
    throw Exception(msg);
  }
});
