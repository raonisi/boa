/// 사용자 화면용 상태·우선순위 라벨 — API raw 값과 표시 문구 분리.
library;

bool boaIsRawEnglishEnum(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return false;
  return RegExp(r'^[a-z][a-z0-9_:-]*$', caseSensitive: false).hasMatch(trimmed);
}

const Map<String, String> _englishStatusLabels = {
  'active': '활성',
  'inactive': '비활성',
  'resigned': '퇴사자',
  'scheduled': '예정',
  'postponed': '연기',
  'completed': '완료',
  'cancelled': '취소',
  'canceled': '취소',
  'pending': '대기',
  'approved': '승인',
  'rejected': '반려',
  'failed': '실패',
  'success': '성공',
  'sent': '성공',
  'skipped': '건너뜀',
  'resolved': '해결됨',
  'open': '진행 중',
  'high': '높음',
  'medium': '보통',
  'low': '낮음',
  'urgent': '긴급',
  'normal': '보통',
  'important': '중요',
  'unclassified': '미분류',
  'unknown': '확인 필요',
  'not_contacted': '미상담',
  'contacted': '연락 완료',
  'follow_up_required': '후속 필요',
  'overdue': '지연',
  'data_download': '데이터 다운로드',
  'achieved': '달성',
  'in_progress': '진행 중',
  'inprogress': '진행 중',
  'unread': '미확인',
  'read': '확인',
  'processed': '처리완료',
  'on_hold': '보류',
};

String _lookupEnglishStatusLabel(String key) {
  final lower = key.toLowerCase();
  return _englishStatusLabels[lower] ?? _englishStatusLabels[key] ?? '';
}

/// 일반 상태 라벨 (영어 enum → 한국어, 한국어 값은 그대로).
String boaUserStatusLabel(
  String? status, {
  String emptyLabel = '상태 미지정',
}) {
  if (status == null) return emptyLabel;
  final key = status.trim();
  if (key.isEmpty) return emptyLabel;

  final mapped = _lookupEnglishStatusLabel(key);
  if (mapped.isNotEmpty) return mapped;
  if (boaIsRawEnglishEnum(key)) return '기타 상태';
  return key;
}

String consultStatusLabel(String? status) => boaUserStatusLabel(status);

String followUpStatusLabel(String? status) => boaUserStatusLabel(status);

String scheduleStatusLabel(String? status) => boaUserStatusLabel(status);

String contractStatusLabel(String? status) => boaUserStatusLabel(status);

String goalStatusLabel(String? status) {
  if (status == null || status.trim().isEmpty) return '';
  return boaUserStatusLabel(status, emptyLabel: '');
}

String notificationStatusLabel(String? status) => boaUserStatusLabel(status);

/// 고객 우선순위 라벨 (A/B 등급은 유지).
String priorityLabel(String? priority) {
  if (priority == null || priority.isEmpty || priority == 'unclassified') {
    return '미분류';
  }
  switch (priority.toUpperCase()) {
    case 'URGENT':
      return '긴급';
    case 'HIGH':
      return '높음';
    case 'MEDIUM':
    case 'NORMAL':
      return '보통';
    case 'LOW':
      return '낮음';
    case 'IMPORTANT':
      return '중요';
    default:
      if (priority == 'A' || priority == 'B' || priority == 'C' || priority == 'D') {
        return priority;
      }
      final mapped = _lookupEnglishStatusLabel(priority);
      if (mapped.isNotEmpty) return mapped;
      if (boaIsRawEnglishEnum(priority)) return '확인 필요';
      return priority;
  }
}
