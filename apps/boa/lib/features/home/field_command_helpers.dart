/// Field Command Center — 순수 로직 (테스트 가능).
library;

bool fieldIsOpenFollowUp(String status) => status == 'scheduled' || status == 'postponed';

bool fieldIsFinishedSchedule(String status) => status == '완료' || status == '취소' || status == '노쇼';

int? fieldCoerceId(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse('$v');
}

String fieldDateOnlyApi(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String fieldFmtDateTime(dynamic t) {
  if (t == null) return '';
  final s = '$t';
  if (s.length >= 16) return s.substring(0, 16).replaceFirst('T', ' ');
  return s;
}

String fieldFmtTime(dynamic t) {
  if (t == null) return '';
  final s = '$t';
  if (s.length >= 16) return s.substring(11, 16);
  return s;
}

String fieldCommaInt(int n) {
  final s = n.toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
    buf.write(s[i]);
  }
  return buf.toString();
}

/// 연체 후속을 먼저, 그다음 오늘 후속 (동일 id 제외).
List<Map<String, dynamic>> fieldMergeContactQueue({
  required List<Map<String, dynamic>> overdue,
  required List<Map<String, dynamic>> today,
  int limit = 8,
}) {
  final seen = <int>{};
  final out = <Map<String, dynamic>>[];

  void addAll(List<Map<String, dynamic>> src) {
    for (final raw in src) {
      final id = fieldCoerceId(raw['id']);
      if (id != null) {
        if (seen.contains(id)) continue;
        seen.add(id);
      }
      out.add(raw);
      if (out.length >= limit) return;
    }
  }

  addAll(overdue);
  if (out.length < limit) addAll(today);
  return out;
}

int fieldTodayActionCount({
  required int todayFollowUpCount,
  required int todayScheduleCount,
  required int pendingNotificationCount,
}) =>
    todayFollowUpCount + todayScheduleCount + pendingNotificationCount;
