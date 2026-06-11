import 'package:boa/core/auth/session_models.dart';
import 'package:boa/features/calendar/calendar_schedule_scope.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CalendarScheduleScope', () {
    test('toQueryParameters maps mine by default', () {
      const scope = CalendarScheduleScope();
      expect(scope.toQueryParameters(), {'viewMode': 'mine'});
    });

    test('toQueryParameters includes ownerUserId for user mode', () {
      const scope = CalendarScheduleScope(viewMode: ScheduleViewMode.user, ownerUserId: 42);
      expect(scope.toQueryParameters(), {'viewMode': 'user', 'ownerUserId': '42'});
    });

    test('effectiveRequestScope falls back to mine without owner', () {
      const scope = CalendarScheduleScope(viewMode: ScheduleViewMode.user);
      expect(scope.effectiveRequestScope().viewMode, ScheduleViewMode.mine);
    });
  });

  group('scheduleScopeOptionsForRole', () {
    test('member only sees mine', () {
      final opts = scheduleScopeOptionsForRole(BoaRole.member);
      expect(opts.length, 1);
      expect(opts.first.viewMode, ScheduleViewMode.mine);
    });

    test('branch_admin sees mine, organization, user', () {
      final opts = scheduleScopeOptionsForRole(BoaRole.branchAdmin);
      expect(opts.map((o) => o.viewMode).toList(), [
        ScheduleViewMode.mine,
        ScheduleViewMode.organization,
        ScheduleViewMode.user,
      ]);
    });

    test('team_leader sees team option', () {
      final opts = scheduleScopeOptionsForRole(BoaRole.teamLeader);
      expect(opts.any((o) => o.viewMode == ScheduleViewMode.team), isTrue);
    });
  });

  group('filterSchedulesToAllowedUsers', () {
    test('filters schedules outside allowed set', () {
      final filtered = filterSchedulesToAllowedUsers([
        {'id': 1, 'userId': 10},
        {'id': 2, 'ownerUserId': 20},
        {'id': 3, 'userId': 30},
      ], {10, 30});
      expect(filtered.length, 2);
      expect(filtered.map((s) => s['id']).toList(), [1, 3]);
    });
  });

  group('scheduleScopeSummaryLabel', () {
    test('uses Korean labels', () {
      expect(
        scheduleScopeSummaryLabel(
          scope: const CalendarScheduleScope(viewMode: ScheduleViewMode.organization),
          role: BoaRole.branchAdmin,
        ),
        '전체 일정',
      );
      expect(
        scheduleScopeSummaryLabel(
          scope: const CalendarScheduleScope(viewMode: ScheduleViewMode.organization),
          role: BoaRole.subBranchAdmin,
        ),
        '산하 전체 일정',
      );
    });
  });
}
