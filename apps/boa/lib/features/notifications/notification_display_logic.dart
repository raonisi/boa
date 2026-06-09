import 'package:flutter/material.dart';

/// 알림 유형 한글 라벨 (Web `Notifications.tsx` typeLabels 와 동일).
const Map<String, String> notificationTypeLabels = {
  'contract_90': '계약 90일 점검',
  'contract_180': '계약 180일 점검',
  'contract_365': '계약 365일 점검',
  'birthday': '생일 알림',
  'uncontacted_3days': '3일 미상담',
  'long_unmanaged_90': '90일 장기 미관리',
  'reconsult': '재상담 알림',
  'unpaid_lapse': '미납·실효 알림',
  'schedule_1day': '일정 하루 전',
  'schedule_today': '일정 당일',
  'schedule_1hour': '일정 1시간 전',
  'schedule_incomplete': '미완료 일정',
  'customer_assigned': '고객 배정',
  'general': '일반',
};

enum NotificationCategory {
  todayWork,
  followUp,
  schedule,
  contractWork,
  system,
  other,
}

enum NotificationReadFilter { all, unread, read }

NotificationCategory notificationCategory(Map<String, dynamic> raw) {
  final type = '${raw['type'] ?? ''}';
  final relatedType = '${raw['relatedType'] ?? ''}';

  if (relatedType == 'follow_up' ||
      type.contains('follow') ||
      type == 'uncontacted_3days' ||
      type == 'long_unmanaged_90' ||
      type == 'reconsult') {
    return NotificationCategory.followUp;
  }
  if (relatedType == 'schedule' || type.startsWith('schedule_')) {
    return NotificationCategory.schedule;
  }
  if (relatedType == 'contract' || type.startsWith('contract_') || type == 'unpaid_lapse') {
    return NotificationCategory.contractWork;
  }
  if (type == 'customer_assigned' || relatedType == 'delete_request') {
    return NotificationCategory.system;
  }
  if (type == 'birthday' || type == 'schedule_today' || type == 'schedule_1hour') {
    return NotificationCategory.todayWork;
  }
  if (relatedType == 'customer' || relatedType == 'consultation') {
    return NotificationCategory.todayWork;
  }
  return NotificationCategory.other;
}

String notificationCategoryLabel(NotificationCategory category) => switch (category) {
      NotificationCategory.todayWork => '오늘 업무',
      NotificationCategory.followUp => '후속관리',
      NotificationCategory.schedule => '일정',
      NotificationCategory.contractWork => '계약/업무',
      NotificationCategory.system => '시스템 안내',
      NotificationCategory.other => '기타',
    };

IconData notificationCategoryIcon(NotificationCategory category) => switch (category) {
      NotificationCategory.todayWork => Icons.today_outlined,
      NotificationCategory.followUp => Icons.support_agent_outlined,
      NotificationCategory.schedule => Icons.event_outlined,
      NotificationCategory.contractWork => Icons.description_outlined,
      NotificationCategory.system => Icons.info_outline,
      NotificationCategory.other => Icons.notifications_outlined,
    };

Color notificationCategoryColor(NotificationCategory category, ColorScheme cs) => switch (category) {
      NotificationCategory.todayWork => cs.primary,
      NotificationCategory.followUp => Colors.deepOrange.shade700,
      NotificationCategory.schedule => Colors.indigo.shade600,
      NotificationCategory.contractWork => Colors.teal.shade700,
      NotificationCategory.system => cs.onSurfaceVariant,
      NotificationCategory.other => cs.outline,
    };

String notificationTypeLabel(Map<String, dynamic> raw) {
  final type = '${raw['type'] ?? ''}';
  return notificationTypeLabels[type] ?? '기타 알림';
}

String notificationProcessStatus(Map<String, dynamic> raw) {
  final status = '${raw['processStatus'] ?? ''}'.trim();
  return status.isEmpty ? '미확인' : status;
}

(Color bg, Color fg) processStatusChipColors(String status) {
  switch (status) {
    case '처리완료':
      return (Colors.green.shade100, Colors.green.shade700);
    case '미확인':
      return (Colors.red.shade50, Colors.red.shade700);
    case '보류':
      return (Colors.amber.shade100, Colors.amber.shade800);
    case '확인':
    default:
      return (Colors.blueGrey.shade100, Colors.blueGrey.shade700);
  }
}

Color processStatusAccentColor(String status) => switch (status) {
      '처리완료' => Colors.green.shade400,
      '미확인' => Colors.red.shade400,
      '보류' => Colors.amber.shade400,
      '확인' => Colors.blue.shade400,
      _ => Colors.blueGrey.shade400,
    };

String formatNotificationDateTime(dynamic value) {
  if (value == null) return '';
  final parsed = DateTime.tryParse('$value');
  if (parsed == null) {
    final s = '$value';
    if (s.length >= 16) return s.substring(0, 16).replaceFirst('T', ' ');
    return s;
  }
  final local = parsed.toLocal();
  final y = local.year;
  final mo = local.month.toString().padLeft(2, '0');
  final d = local.day.toString().padLeft(2, '0');
  final h = local.hour.toString().padLeft(2, '0');
  final mi = local.minute.toString().padLeft(2, '0');
  return '$y-$mo-$d $h:$mi';
}

String notificationBodyText(Map<String, dynamic> raw) {
  final message = '${raw['message'] ?? ''}'.trim();
  if (message.isNotEmpty) return message;
  return notificationTypeLabel(raw);
}

int notificationId(Map<String, dynamic> raw) {
  final idVal = raw['id'];
  if (idVal is int) return idVal;
  return int.tryParse('$idVal') ?? 0;
}

int? notificationRelatedId(Map<String, dynamic> raw) {
  final idVal = raw['relatedId'];
  if (idVal == null) return null;
  if (idVal is int) return idVal > 0 ? idVal : null;
  final parsed = int.tryParse('$idVal');
  return parsed != null && parsed > 0 ? parsed : null;
}

String notificationRelatedType(Map<String, dynamic> raw) => '${raw['relatedType'] ?? ''}'.trim();

bool notificationMatchesReadFilter(Map<String, dynamic> raw, NotificationReadFilter filter) {
  final isRead = raw['isRead'] == true || raw['isRead'] == 1;
  return switch (filter) {
    NotificationReadFilter.all => true,
    NotificationReadFilter.unread => !isRead,
    NotificationReadFilter.read => isRead,
  };
}
