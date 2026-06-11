import 'package:boa/core/auth/session_models.dart';

/// PC Calendar `schedules.list` viewMode와 동일.
enum ScheduleViewMode { mine, user, team, organization }

class CalendarScheduleScope {
  const CalendarScheduleScope({
    this.viewMode = ScheduleViewMode.mine,
    this.ownerUserId,
    this.teamId,
  });

  final ScheduleViewMode viewMode;
  final int? ownerUserId;
  final int? teamId;

  CalendarScheduleScope copyWith({
    ScheduleViewMode? viewMode,
    int? ownerUserId,
    bool clearOwnerUserId = false,
    int? teamId,
    bool clearTeamId = false,
  }) {
    return CalendarScheduleScope(
      viewMode: viewMode ?? this.viewMode,
      ownerUserId: clearOwnerUserId ? null : (ownerUserId ?? this.ownerUserId),
      teamId: clearTeamId ? null : (teamId ?? this.teamId),
    );
  }

  Map<String, String> toQueryParameters() {
    final params = <String, String>{
      'viewMode': switch (viewMode) {
        ScheduleViewMode.mine => 'mine',
        ScheduleViewMode.user => 'user',
        ScheduleViewMode.team => 'team',
        ScheduleViewMode.organization => 'organization',
      },
    };
    if (viewMode == ScheduleViewMode.user && ownerUserId != null) {
      params['ownerUserId'] = '$ownerUserId';
    }
    if (viewMode == ScheduleViewMode.team && teamId != null) {
      params['teamId'] = '$teamId';
    }
    return params;
  }

  /// API 호출용 — user/team 선택이 없으면 mine으로 폴백 (PC Calendar와 동일).
  CalendarScheduleScope effectiveRequestScope() {
    if (viewMode == ScheduleViewMode.user && (ownerUserId == null || ownerUserId! <= 0)) {
      return const CalendarScheduleScope(viewMode: ScheduleViewMode.mine);
    }
    if (viewMode == ScheduleViewMode.team && (teamId == null || teamId! <= 0)) {
      return const CalendarScheduleScope(viewMode: ScheduleViewMode.mine);
    }
    return this;
  }

  bool get showsOwnerName => viewMode != ScheduleViewMode.mine;
}

class ScheduleScopeOption {
  const ScheduleScopeOption({
    required this.viewMode,
    required this.label,
    this.description,
  });

  final ScheduleViewMode viewMode;
  final String label;
  final String? description;
}

List<ScheduleScopeOption> scheduleScopeOptionsForRole(BoaRole role) {
  switch (role) {
    case BoaRole.branchAdmin:
      return const [
        ScheduleScopeOption(viewMode: ScheduleViewMode.mine, label: '내 일정'),
        ScheduleScopeOption(
          viewMode: ScheduleViewMode.organization,
          label: '전체 일정',
          description: '지점 전체 일정 조회',
        ),
        ScheduleScopeOption(
          viewMode: ScheduleViewMode.user,
          label: '사용자 선택',
          description: '특정 직원 일정 조회',
        ),
      ];
    case BoaRole.subBranchAdmin:
      return const [
        ScheduleScopeOption(viewMode: ScheduleViewMode.mine, label: '내 일정'),
        ScheduleScopeOption(
          viewMode: ScheduleViewMode.organization,
          label: '산하 전체',
          description: '산하 조직 일정 조회',
        ),
        ScheduleScopeOption(
          viewMode: ScheduleViewMode.user,
          label: '사용자 선택',
          description: '산하 직원 일정 조회',
        ),
      ];
    case BoaRole.teamLeader:
      return const [
        ScheduleScopeOption(viewMode: ScheduleViewMode.mine, label: '내 일정'),
        ScheduleScopeOption(
          viewMode: ScheduleViewMode.team,
          label: '팀 전체',
          description: '소속 팀 일정 조회',
        ),
        ScheduleScopeOption(
          viewMode: ScheduleViewMode.user,
          label: '팀원 선택',
          description: '팀원 일정 조회',
        ),
      ];
    case BoaRole.member:
      return const [
        ScheduleScopeOption(viewMode: ScheduleViewMode.mine, label: '내 일정'),
      ];
  }
}

String scheduleScopeSummaryLabel({
  required CalendarScheduleScope scope,
  required BoaRole role,
  String? ownerName,
  String? teamName,
}) {
  return switch (scope.viewMode) {
    ScheduleViewMode.mine => '내 일정',
    ScheduleViewMode.organization => role == BoaRole.branchAdmin ? '전체 일정' : '산하 전체 일정',
    ScheduleViewMode.team => teamName != null && teamName.isNotEmpty ? '팀 · $teamName' : '팀 전체 일정',
    ScheduleViewMode.user =>
      ownerName != null && ownerName.isNotEmpty ? '사용자 · $ownerName' : '사용자 일정',
  };
}

int? readScheduleOwnerUserId(Map<String, dynamic> raw) {
  final v = raw['ownerUserId'] ?? raw['userId'];
  if (v is int) return v;
  if (v is num) return v.round();
  return int.tryParse('$v');
}

List<Map<String, dynamic>> filterSchedulesToAllowedUsers(
  List<Map<String, dynamic>> schedules,
  Set<int> allowedUserIds,
) {
  if (allowedUserIds.isEmpty) return schedules;
  return schedules.where((s) {
    final ownerId = readScheduleOwnerUserId(s);
    return ownerId != null && allowedUserIds.contains(ownerId);
  }).toList();
}

bool scheduleCanEdit(Map<String, dynamic> raw) {
  final v = raw['canEdit'];
  if (v is bool) return v;
  return true;
}
