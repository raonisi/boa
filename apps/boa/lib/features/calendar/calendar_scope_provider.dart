import 'package:boa/core/auth/session_controller.dart';
import 'package:boa/core/auth/session_models.dart';
import 'package:boa/features/calendar/calendar_schedule_scope.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CalendarScopeNotifier extends Notifier<CalendarScheduleScope> {
  @override
  CalendarScheduleScope build() {
    ref.listen(sessionProvider, (prev, next) {
      final role = next?.user.role ?? BoaRole.member;
      if (role == BoaRole.member && state.viewMode != ScheduleViewMode.mine) {
        state = const CalendarScheduleScope();
      }
    });
    return const CalendarScheduleScope();
  }

  void setViewMode(ScheduleViewMode mode) {
    final role = ref.read(sessionProvider)?.user.role ?? BoaRole.member;
    if (role == BoaRole.member && mode != ScheduleViewMode.mine) return;
    state = CalendarScheduleScope(viewMode: mode);
  }

  void selectOwner(int userId) {
    final role = ref.read(sessionProvider)?.user.role ?? BoaRole.member;
    if (role == BoaRole.member) return;
    state = CalendarScheduleScope(viewMode: ScheduleViewMode.user, ownerUserId: userId);
  }

  void selectTeam(int teamId) {
    final role = ref.read(sessionProvider)?.user.role ?? BoaRole.member;
    if (role == BoaRole.member) return;
    state = CalendarScheduleScope(viewMode: ScheduleViewMode.team, teamId: teamId);
  }

  void resetToMine() {
    state = const CalendarScheduleScope();
  }
}

final calendarScopeProvider =
    NotifierProvider<CalendarScopeNotifier, CalendarScheduleScope>(CalendarScopeNotifier.new);
