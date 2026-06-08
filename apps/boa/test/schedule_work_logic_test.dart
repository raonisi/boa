import 'package:boa/features/calendar/schedule_work_logic.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final now = DateTime(2026, 6, 8, 12);

  final items = [
    {
      'id': 1,
      'title': '[TEST] Today morning',
      'startTime': '2026-06-08T09:00:00.000',
      'status': '예정',
    },
    {
      'id': 2,
      'title': '[TEST] Tomorrow',
      'startTime': '2026-06-09T14:00:00.000',
      'status': '예정',
    },
    {
      'id': 3,
      'title': '[TEST] Done today',
      'startTime': '2026-06-08T11:00:00.000',
      'status': '완료',
    },
  ];

  test('todayOpenSchedules returns only open schedules for today', () {
    final today = todayOpenSchedules(items, now);
    expect(today.map((e) => e['id']), [1]);
  });

  test('upcomingOpenSchedules returns future open schedules', () {
    final upcoming = upcomingOpenSchedules(items, now);
    expect(upcoming.map((e) => e['id']), [2]);
  });

  test('sortSchedulesByStart orders by startTime ascending', () {
    final shuffled = [items[2], items[1], items[0]];
    final sorted = sortSchedulesByStart(shuffled);
    expect(sorted.map((e) => e['id']), [1, 3, 2]);
  });
}
