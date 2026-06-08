import 'package:boa/features/calendar/calendar_agenda_provider.dart';
import 'package:boa/features/home/field_command_helpers.dart';

DateTime? parseScheduleStart(dynamic raw) {
  if (raw is Map<String, dynamic>) return parseApiDate(raw['startTime']);
  return parseApiDate(raw);
}

bool isOpenSchedule(Map<String, dynamic> raw) => !fieldIsFinishedSchedule('${raw['status'] ?? ''}');

List<Map<String, dynamic>> sortSchedulesByStart(List<Map<String, dynamic>> items) {
  final sorted = [...items];
  sorted.sort((a, b) {
    final ta = parseScheduleStart(a) ?? DateTime.fromMillisecondsSinceEpoch(0);
    final tb = parseScheduleStart(b) ?? DateTime.fromMillisecondsSinceEpoch(0);
    return ta.compareTo(tb);
  });
  return sorted;
}

/// 오늘 미완료 일정.
List<Map<String, dynamic>> todayOpenSchedules(List<Map<String, dynamic>> items, DateTime now) {
  return sortSchedulesByStart(items).where((s) {
    if (!isOpenSchedule(s)) return false;
    final start = parseScheduleStart(s);
    return start != null && isSameCalendarDay(start, now);
  }).toList();
}

/// 오늘 이후 예정 미완료 일정.
List<Map<String, dynamic>> upcomingOpenSchedules(List<Map<String, dynamic>> items, DateTime now) {
  final todayEnd = DateTime(now.year, now.month, now.day, 23, 59, 59);
  return sortSchedulesByStart(items).where((s) {
    if (!isOpenSchedule(s)) return false;
    final start = parseScheduleStart(s);
    return start != null && start.isAfter(todayEnd);
  }).toList();
}
