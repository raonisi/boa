import 'package:boa/core/api/dio_provider.dart';
import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/auth/session_models.dart';
import 'package:boa/core/config/app_config.dart';
import 'package:boa/features/calendar/calendar_schedule_scope.dart';
import 'package:boa/features/calendar/calendar_scope_provider.dart';
import 'package:boa/features/contracts/contract_agents_provider.dart';
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

class ScheduleViewUser {
  const ScheduleViewUser({
    required this.userId,
    required this.name,
    this.teamId,
    this.teamName,
  });

  final int userId;
  final String name;
  final int? teamId;
  final String? teamName;

  factory ScheduleViewUser.fromJson(Map<String, dynamic> json) {
    final id = json['userId'] ?? json['id'];
    return ScheduleViewUser(
      userId: id is int ? id : int.tryParse('$id') ?? 0,
      name: (json['name'] as String?)?.trim().isNotEmpty == true ? (json['name'] as String).trim() : '사용자',
      teamId: json['teamId'] is int ? json['teamId'] as int : int.tryParse('${json['teamId']}'),
      teamName: json['teamName'] as String?,
    );
  }
}

class ScheduleViewTeam {
  const ScheduleViewTeam({required this.teamId, required this.name});

  final int teamId;
  final String name;

  factory ScheduleViewTeam.fromJson(Map<String, dynamic> json) {
    final id = json['teamId'] ?? json['id'];
    return ScheduleViewTeam(
      teamId: id is int ? id : int.tryParse('$id') ?? 0,
      name: (json['name'] as String?)?.trim().isNotEmpty == true ? (json['name'] as String).trim() : '팀',
    );
  }
}

class CalendarAgenda {
  const CalendarAgenda({
    required this.schedules,
    required this.followUpsToday,
    required this.followUpsOverdue,
    this.viewUsers = const [],
    this.viewTeams = const [],
    this.organizationViewWarning,
    this.appliedScope = const CalendarScheduleScope(),
  });

  final List<Map<String, dynamic>> schedules;
  final List<Map<String, dynamic>> followUpsToday;
  final List<Map<String, dynamic>> followUpsOverdue;
  final List<ScheduleViewUser> viewUsers;
  final List<ScheduleViewTeam> viewTeams;
  final String? organizationViewWarning;
  final CalendarScheduleScope appliedScope;
}

final calendarAgendaProvider = FutureProvider.autoDispose<CalendarAgenda>((ref) async {
  if (!AppConfig.hasApiBase) {
    throw Exception('BOA_API_BASE_URL 미설정');
  }
  final session = ref.watch(sessionProvider);
  if (session == null) {
    throw Exception('세션 없음');
  }
  if (!session.user.isActive) {
    throw Exception('일정을 조회할 수 없습니다.');
  }

  final scope = ref.watch(calendarScopeProvider);
  final requestScope = scope.effectiveRequestScope();
  final dio = ref.watch(dioProvider);

  try {
    final scheduleRes = await dio.get<Map<String, dynamic>>(
      '/api/mobile/schedules',
      queryParameters: requestScope.toQueryParameters(),
    );
    final scheduleBody = scheduleRes.data;
    var schedules = _items(scheduleBody, 'items');
    final viewUsers = _items(scheduleBody, 'users').map(ScheduleViewUser.fromJson).where((u) => u.userId > 0).toList();
    final viewTeams = _items(scheduleBody, 'teams').map(ScheduleViewTeam.fromJson).where((t) => t.teamId > 0).toList();
    final orgWarning = scheduleBody?['organizationViewWarning'] as String?;

    if (session.user.role == BoaRole.subBranchAdmin && requestScope.viewMode == ScheduleViewMode.organization) {
      final agents = await ref.read(assignableAgentsProvider.future);
      final allowed = {session.user.id, ...agents.map((a) => a.id)};
      schedules = filterSchedulesToAllowedUsers(schedules, allowed);
    }

    final followUpResults = await Future.wait<List<Map<String, dynamic>>>([
      dio.get<Map<String, dynamic>>('/api/mobile/follow-ups/today').then((r) => _items(r.data, 'items')),
      dio.get<Map<String, dynamic>>('/api/mobile/follow-ups/overdue').then((r) => _items(r.data, 'items')),
    ]);

    return CalendarAgenda(
      schedules: schedules,
      followUpsToday: followUpResults[0],
      followUpsOverdue: followUpResults[1],
      viewUsers: viewUsers,
      viewTeams: viewTeams,
      organizationViewWarning: orgWarning,
      appliedScope: requestScope,
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
