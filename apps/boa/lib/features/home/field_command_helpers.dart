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

/// 사용자가 선택한 로컬 날짜·시간을 결합합니다 (기기 로컬 = KST 운영 기준).
DateTime combineLocalDateAndTime(DateTime date, int hour, int minute) =>
    DateTime(date.year, date.month, date.day, hour, minute);

/// 서버 일정 API는 KST 로컬 시각 문자열(`YYYY-MM-DDTHH:mm:ss`)을 기대합니다.
String encodeScheduleDateTimeForApi(DateTime localDateTime) {
  final y = localDateTime.year.toString().padLeft(4, '0');
  final mo = localDateTime.month.toString().padLeft(2, '0');
  final d = localDateTime.day.toString().padLeft(2, '0');
  final h = localDateTime.hour.toString().padLeft(2, '0');
  final mi = localDateTime.minute.toString().padLeft(2, '0');
  final s = localDateTime.second.toString().padLeft(2, '0');
  return '$y-$mo-$d' 'T' '$h:$mi:$s';
}

final _kstLocalDateTimeRe = RegExp(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}');

bool _isTimezoneNaiveLocalDateTime(String value) {
  if (!_kstLocalDateTimeRe.hasMatch(value)) return false;
  return !value.endsWith('Z') && !value.contains('+') && value.indexOf('-', 10) == -1;
}

/// API 날짜/시간 문자열을 표시·정렬용 로컬 [DateTime]으로 변환합니다.
DateTime? decodeApiDateTime(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value.toLocal();
  final text = '$value'.trim();
  if (text.isEmpty) return null;
  if (_isTimezoneNaiveLocalDateTime(text)) {
    return DateTime.tryParse(text);
  }
  return DateTime.tryParse(text)?.toLocal();
}

String _pad2(int n) => n.toString().padLeft(2, '0');

String formatScheduleDateTimeKo(DateTime value) {
  final local = value.toLocal();
  return '${local.year}-${_pad2(local.month)}-${_pad2(local.day)} ${_pad2(local.hour)}:${_pad2(local.minute)}';
}

String formatScheduleTimeKo(DateTime value) {
  final local = value.toLocal();
  return '${_pad2(local.hour)}:${_pad2(local.minute)}';
}

String fieldFmtDateTime(dynamic t) {
  final dt = decodeApiDateTime(t);
  if (dt != null) return formatScheduleDateTimeKo(dt);
  return t == null ? '' : '$t';
}

String fieldFmtTime(dynamic t) {
  final dt = decodeApiDateTime(t);
  if (dt != null) return formatScheduleTimeKo(dt);
  return t == null ? '' : '$t';
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

const _koreanWeekdays = ['월', '화', '수', '목', '금', '토', '일'];

String fieldKoreanWeekday(DateTime d) => _koreanWeekdays[d.weekday - 1];

String fieldKoreanDateHeader(DateTime d) =>
    '${d.year}년 ${d.month}월 ${d.day}일 (${fieldKoreanWeekday(d)})';

int fieldTodayActionCount({
  required int todayFollowUpCount,
  required int todayScheduleCount,
  required int pendingNotificationCount,
}) =>
    todayFollowUpCount + todayScheduleCount + pendingNotificationCount;
