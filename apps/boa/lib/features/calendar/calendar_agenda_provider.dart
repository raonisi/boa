import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/home/field_command_helpers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

List<Map<String, dynamic>> _items(Map<String, dynamic>? body, String key) {
  final raw = body?[key];
  if (raw is! List) return const [];
  return raw
      .map((e) => e is Map<String, dynamic> ? e : (e is Map ? Map<String, dynamic>.from(e) : null))
      .whereType<Map<String, dynamic>>()
      .toList();
}

class CalendarAgenda {
  const CalendarAgenda({
    required this.schedules,
    required this.followUpsToday,
    required this.followUpsOverdue,
  });

  final List<Map<String, dynamic>> schedules;
  final List<Map<String, dynamic>> followUpsToday;
  final List<Map<String, dynamic>> followUpsOverdue;
}

final calendarAgendaProvider = FutureProvider.autoDispose<CalendarAgenda>((ref) async {
  if (!AppConfig.hasApiBase) {
    throw Exception('BOA_API_BASE_URL 미설정');
  }
  if (ref.watch(sessionProvider) == null) {
    throw Exception('세션 없음');
  }
  final dio = ref.watch(dioProvider);
  try {
    final results = await Future.wait<List<Map<String, dynamic>>>([
      dio.get<Map<String, dynamic>>('/api/mobile/schedules').then((r) => _items(r.data, 'items')),
      dio.get<Map<String, dynamic>>('/api/mobile/follow-ups/today').then((r) => _items(r.data, 'items')),
      dio.get<Map<String, dynamic>>('/api/mobile/follow-ups/overdue').then((r) => _items(r.data, 'items')),
    ]);
    return CalendarAgenda(
      schedules: results[0],
      followUpsToday: results[1],
      followUpsOverdue: results[2],
    );
  } on DioException catch (e) {
    final body = e.response?.data;
    String msg = '일정 데이터를 불러오지 못했습니다.';
    if (body is Map && body['error'] != null) msg = '${body['error']}';
    throw Exception(msg);
  }
});

DateTime? parseApiDate(dynamic v) => decodeApiDateTime(v);

bool isSameCalendarDay(DateTime a, DateTime b) {
  return a.year == b.year && a.month == b.month && a.day == b.day;
}
