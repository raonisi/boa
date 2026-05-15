enum NotificationPriority { urgent, today, general }

const Set<String> _urgentTypes = {
  'schedule_incomplete',
  'long_unmanaged_90',
  'unpaid_lapse',
  'reconsult',
  'uncontacted_3days',
};

const Set<String> _todayTypes = {
  'schedule_today',
  'schedule_1hour',
  'birthday',
};

NotificationPriority classifyNotificationPriority(Map<String, dynamic> raw) {
  final type = '${raw['type'] ?? ''}';
  if (_urgentTypes.contains(type)) return NotificationPriority.urgent;
  if (_todayTypes.contains(type)) return NotificationPriority.today;

  final dueAtRaw = raw['dueAt'];
  if (dueAtRaw != null) {
    final dueAt = DateTime.tryParse('$dueAtRaw');
    if (dueAt != null) {
      final now = DateTime.now();
      final due = DateTime(dueAt.year, dueAt.month, dueAt.day);
      final today = DateTime(now.year, now.month, now.day);
      if (!due.isAfter(today)) return NotificationPriority.today;
    }
  }
  return NotificationPriority.general;
}

int notificationPriorityWeight(NotificationPriority priority) {
  switch (priority) {
    case NotificationPriority.urgent:
      return 0;
    case NotificationPriority.today:
      return 1;
    case NotificationPriority.general:
      return 2;
  }
}

bool notificationIsRead(Map<String, dynamic> raw) {
  return raw['isRead'] == true || raw['isRead'] == 1;
}

List<Map<String, dynamic>> sortNotificationsForQueue(Iterable<Map<String, dynamic>> items) {
  final sorted = items.toList(growable: true);
  sorted.sort((a, b) {
    final pa = classifyNotificationPriority(a);
    final pb = classifyNotificationPriority(b);
    final priorityDiff = notificationPriorityWeight(pa) - notificationPriorityWeight(pb);
    if (priorityDiff != 0) return priorityDiff;

    final aRead = notificationIsRead(a);
    final bRead = notificationIsRead(b);
    if (aRead != bRead) return aRead ? 1 : -1;

    final at = DateTime.tryParse('${a['createdAt'] ?? ''}') ?? DateTime.fromMillisecondsSinceEpoch(0);
    final bt = DateTime.tryParse('${b['createdAt'] ?? ''}') ?? DateTime.fromMillisecondsSinceEpoch(0);
    return bt.compareTo(at);
  });
  return sorted;
}
